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
        timeout: int = 300,
        env: Optional[Dict[str, str]] = None,
        cwd: Optional[str] = None
    ) -> CommandResult:
        """
        Execute a command on a remote host.
        
        Args:
            host_key: Registered host identifier
            command: Command to execute
            timeout: Command timeout in seconds
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
        timeout: int = 300,
        env: Optional[Dict[str, str]] = None,
        cwd: Optional[str] = None,
        on_stdout: Optional[callable] = None,
        on_stderr: Optional[callable] = None
    ) -> CommandResult:
        """
        Execute a command with streaming output callbacks.
        
        Args:
            host_key: Registered host identifier
            command: Command to execute
            timeout: Command timeout in seconds
            env: Environment variables
            cwd: Working directory
            on_stdout: Callback for stdout chunks
            on_stderr: Callback for stderr chunks
            
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
                async with conn.create_process(full_command) as process:
                    # Read stdout and stderr concurrently
                    async def read_stream(stream, chunks_list, callback):
                        async for line in stream:
                            chunks_list.append(line)
                            if callback:
                                if asyncio.iscoroutinefunction(callback):
                                    await callback(line)
                                else:
                                    callback(line)
                    
                    await asyncio.gather(
                        read_stream(process.stdout, stdout_chunks, on_stdout),
                        read_stream(process.stderr, stderr_chunks, on_stderr),
                    )
                    
                    exit_code = await process.wait()
                    duration_ms = int((time.time() - start_time) * 1000)
                    
                    return CommandResult(
                        exit_code=exit_code,
                        stdout="".join(stdout_chunks),
                        stderr="".join(stderr_chunks),
                        duration_ms=duration_ms
                    )
            except asyncio.TimeoutError:
                duration_ms = int((time.time() - start_time) * 1000)
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


async def initialize_ssh_pool_from_db():
    """Initialize SSH pool from database server configurations."""
    from app.database.session import AsyncSessionLocal
    from app.models.models import Server
    from sqlalchemy import select
    
    pool = get_ssh_pool()
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Server))
        servers = result.scalars().all()
        
        for server in servers:
            host_key = f"{server.environment_id}:{server.name}"
            config = SSHConnectionConfig(
                host=server.hostname,
                port=server.port,
                username=server.username,
                key_path=None,
            )
            pool.register_host(host_key, config)
    
    logger.info(f"Initialized SSH pool with {len(servers)} servers")