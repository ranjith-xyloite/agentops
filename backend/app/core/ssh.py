"""
SSH execution layer with connection pooling for AgentOps.
Uses asyncssh for async SSH connections with connection pooling.
"""
import asyncio
import asyncssh
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from contextlib import asynccontextmanager
import logging

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SSHConnectionConfig:
    """Configuration for an SSH connection."""
    host: str
    port: int = 22
    username: str = "root"
    password: Optional[str] = None
    key_path: Optional[str] = None
    known_hosts: Optional[str] = None


@dataclass
class CommandResult:
    """Result of a command execution."""
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int


def _is_connection_closed(conn: Any) -> bool:
    """Safely check if an SSH connection is closed without raising coroutine warnings."""
    if conn is None:
        return True
    try:
        is_closed_attr = getattr(conn, "is_closed", None)
        if callable(is_closed_attr):
            res = is_closed_attr()
            if asyncio.iscoroutine(res):
                res.close()
                return False
            return bool(res)
        elif is_closed_attr is not None:
            return bool(is_closed_attr)
    except Exception:
        pass
    return False


class SSHConnectionPool:
    """
    Connection pool for SSH connections.
    Manages a pool of connections per host to avoid connection overhead.
    """
    
    def __init__(self, max_connections_per_host: int = 5):
        self._pools: Dict[str, asyncio.Queue] = {}
        self._configs: Dict[str, SSHConnectionConfig] = {}
        self._max_connections = max_connections_per_host
        self._lock = asyncio.Lock()
    
    def register_host(self, host_key: str, config: SSHConnectionConfig):
        """Register a host configuration for pooling."""
        self._configs[host_key] = config
        if host_key not in self._pools:
            self._pools[host_key] = asyncio.Queue(maxsize=self._max_connections)
    
    @asynccontextmanager
    async def get_connection(self, host_key: str):
        """Get a connection from the pool, creating one if needed."""
        if host_key not in self._configs:
            raise ValueError(f"Host {host_key} not registered")
        
        pool = self._pools[host_key]
        config = self._configs[host_key]
        
        # Try to get an existing connection
        conn = None
        try:
            conn = pool.get_nowait()
            # Verify connection is still alive
            if _is_connection_closed(conn):
                conn = None
        except asyncio.QueueEmpty:
            pass
        
        # Create new connection if needed
        if conn is None:
            conn = await self._create_connection(config)
        
        try:
            yield conn
        finally:
            # Return to pool if not closed
            if not _is_connection_closed(conn):
                try:
                    pool.put_nowait(conn)
                except asyncio.QueueFull:
                    # Pool full, close the connection
                    conn.close()
                    await conn.wait_closed()
    
    async def _create_connection(self, config: SSHConnectionConfig) -> asyncssh.SSHClientConnection:
        """Create a new SSH connection."""
        connect_kwargs = {
            "host": config.host,
            "port": config.port,
            "username": config.username,
        }
        
        if config.password:
            connect_kwargs["password"] = config.password
        if config.key_path:
            connect_kwargs["client_keys"] = [config.key_path]
        if config.known_hosts:
            connect_kwargs["known_hosts"] = config.known_hosts
        else:
            # For development - accept unknown hosts
            connect_kwargs["known_hosts"] = None
        
        conn = await asyncssh.connect(**connect_kwargs)
        return conn
    
    async def close_all(self):
        """Close all connections in all pools."""
        for pool in self._pools.values():
            while not pool.empty():
                try:
                    conn = pool.get_nowait()
                    conn.close()
                    await conn.wait_closed()
                except asyncio.QueueEmpty:
                    break


class SSHExecutor:
    """
    High-level SSH command executor with connection pooling.
    """
    
    def __init__(self, pool: SSHConnectionPool):
        self.pool = pool
    
    async def execute(
        self,
        host_key: str,
        command: str,
        timeout: int = 1800,
        env: Optional[Dict[str, str]] = None,
        cwd: Optional[str] = None
    ) -> CommandResult:
        """
        Execute a command on a remote host.
        
        Args:
            host_key: Registered host identifier
            command: Command to execute
            timeout: Command timeout in seconds (default 1800s / 30m)
            env: Environment variables
            cwd: Working directory
            
        Returns:
            CommandResult with exit code, stdout, stderr, and duration
        """
        import time
        start_time = time.time()
        
        async with self.pool.get_connection(host_key) as conn:
            # Build command with environment and working directory
            full_command = command
            if cwd:
                full_command = f"cd {cwd} && {command}"
            if env:
                env_str = " ".join(f"{k}={v}" for k, v in env.items())
                full_command = f"{env_str} {full_command}"
            
            try:
                result = await asyncio.wait_for(
                    conn.run(full_command, check=False),
                    timeout=timeout
                )
                duration_ms = int((time.time() - start_time) * 1000)
                
                return CommandResult(
                    exit_code=result.exit_status,
                    stdout=result.stdout,
                    stderr=result.stderr,
                    duration_ms=duration_ms
                )
            except asyncio.TimeoutError:
                duration_ms = int((time.time() - start_time) * 1000)
                return CommandResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"Command timed out after {timeout}s",
                    duration_ms=duration_ms
                )
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                return CommandResult(
                    exit_code=-1,
                    stdout="",
                    stderr=str(e),
                    duration_ms=duration_ms
                )
    
    async def execute_streaming(
        self,
        host_key: str,
        command: str,
        timeout: int = 1800,
        env: Optional[Dict[str, str]] = None,
        cwd: Optional[str] = None,
        on_stdout: Optional[callable] = None,
        on_stderr: Optional[callable] = None
    ) -> CommandResult:
        """
        Execute a command with real-time streaming output callbacks.
        
        Args:
            host_key: Registered host identifier
            command: Command to execute
            timeout: Command timeout in seconds
            env: Environment variables
            cwd: Working directory
            on_stdout: Callback for stdout lines
            on_stderr: Callback for stderr lines
            
        Returns:
            CommandResult with exit code, stdout, stderr, and duration
        """
        import time
        start_time = time.time()
        stdout_chunks = []
        stderr_chunks = []
        
        async with self.pool.get_connection(host_key) as conn:
            full_command = command
            if cwd:
                full_command = f"cd {cwd} && {command}"
            if env:
                env_str = " ".join(f"{k}={v}" for k, v in env.items())
                full_command = f"{env_str} {full_command}"
            
            try:
                # Add unbuffered env for real-time output from python/node/docker/etc
                process = await conn.create_process(full_command, encoding="utf-8")
                
                async def read_stream(stream, chunks_list, callback):
                    if not stream:
                        return
                    try:
                        async for chunk in stream:
                            chunks_list.append(chunk)
                            if callback:
                                for line in chunk.splitlines():
                                    cleaned = line.rstrip("\r\n")
                                    if cleaned:
                                        if asyncio.iscoroutinefunction(callback):
                                            await callback(cleaned)
                                        else:
                                            callback(cleaned)
                    except Exception as e:
                        logger.debug(f"Stream read finished: {e}")
                
                await asyncio.wait_for(
                    asyncio.gather(
                        read_stream(process.stdout, stdout_chunks, on_stdout),
                        read_stream(process.stderr, stderr_chunks, on_stderr),
                    ),
                    timeout=timeout
                )
                
                # In asyncssh, process.exit_status is set once the process completes.
                # process.wait() can return None if streams are already consumed.
                # Use exit_status directly; treat None as 0 (success, no explicit exit)
                try:
                    await asyncio.wait_for(process.wait(), timeout=10)
                except Exception:
                    pass
                raw_exit = process.exit_status
                exit_code = int(raw_exit) if raw_exit is not None else 0
                duration_ms = int((time.time() - start_time) * 1000)
                
                return CommandResult(
                    exit_code=exit_code,
                    stdout="".join(stdout_chunks),
                    stderr="".join(stderr_chunks),
                    duration_ms=duration_ms
                )
            except asyncio.TimeoutError:
                duration_ms = int((time.time() - start_time) * 1000)
                try:
                    process.terminate()
                except Exception:
                    pass
                return CommandResult(
                    exit_code=-1,
                    stdout="".join(stdout_chunks),
                    stderr="".join(stderr_chunks) + f"\nCommand timed out after {timeout}s",
                    duration_ms=duration_ms
                )
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                return CommandResult(
                    exit_code=-1,
                    stdout="".join(stdout_chunks),
                    stderr="".join(stderr_chunks) + f"\n{str(e)}",
                    duration_ms=duration_ms
                )


# Global pool instance
_ssh_pool: Optional[SSHConnectionPool] = None


def get_ssh_pool() -> SSHConnectionPool:
    """Get the global SSH connection pool."""
    global _ssh_pool
    if _ssh_pool is None:
        _ssh_pool = SSHConnectionPool()
    return _ssh_pool


def get_ssh_executor() -> SSHExecutor:
    """Get an SSH executor with the global pool."""
    return SSHExecutor(get_ssh_pool())


def register_server_in_pool(server: Any):
    """Register or update a Server instance in the global SSH connection pool."""
    pool = get_ssh_pool()
    config = SSHConnectionConfig(
        host=server.hostname,
        port=server.port,
        username=server.username,
        password=getattr(server, "password", None),
        key_path=getattr(server, "ssh_key", None),
    )
    pool.register_host(f"server:{server.id}", config)
    pool.register_host(f"{server.id}:{server.name}", config)
    if getattr(server, "environment_id", None):
        pool.register_host(f"{server.environment_id}:{server.name}", config)


async def test_ssh_connection(
    host: str,
    port: int = 22,
    username: str = "deploy",
    password: Optional[str] = None,
    key_path: Optional[str] = None,
    timeout: int = 10
) -> Dict[str, Any]:
    """Directly test SSH connectivity to a remote host with supplied credentials."""
    import time
    start = time.time()
    connect_kwargs = {
        "host": host,
        "port": port,
        "username": username,
        "known_hosts": None,
    }
    if password:
        connect_kwargs["password"] = password
    if key_path:
        connect_kwargs["client_keys"] = [key_path]

    try:
        conn = await asyncio.wait_for(
            asyncssh.connect(**connect_kwargs),
            timeout=timeout
        )
        latency = int((time.time() - start) * 1000)
        res = await asyncio.wait_for(conn.run("uname -a 2>/dev/null || hostname", check=False), timeout=5)
        sys_info = res.stdout.strip() if res.stdout else "Connected successfully"
        conn.close()
        await conn.wait_closed()
        return {
            "success": True,
            "message": f"Successfully authenticated to {username}@{host}:{port}",
            "latency_ms": latency,
            "system_info": sys_info
        }
    except asyncio.TimeoutError:
        return {
            "success": False,
            "message": f"Connection timed out after {timeout}s",
            "latency_ms": int((time.time() - start) * 1000),
            "system_info": None
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"SSH connection failed: {str(e)}",
            "latency_ms": int((time.time() - start) * 1000),
            "system_info": None
        }


async def initialize_ssh_pool_from_db():
    """Initialize SSH pool from database server configurations."""
    from app.database.session import AsyncSessionLocal
    from app.models.models import Server
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Server))
        servers = result.scalars().all()
        
        for server in servers:
            register_server_in_pool(server)
    
    logger.info(f"Initialized SSH pool with {len(servers)} servers")