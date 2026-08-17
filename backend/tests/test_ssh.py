"""
Tests for SSH execution layer.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.ssh import SSHConnectionPool, SSHConnectionConfig, SSHExecutor, CommandResult


def test_ssh_connection_config_defaults():
    """Test SSHConnectionConfig default values."""
    config = SSHConnectionConfig(host="example.com")
    assert config.host == "example.com"
    assert config.port == 22
    assert config.username == "root"
    assert config.password is None
    assert config.key_path is None


def test_command_result_dataclass():
    """Test CommandResult dataclass."""
    result = CommandResult(
        exit_code=0,
        stdout="success",
        stderr="",
        duration_ms=100
    )
    assert result.exit_code == 0
    assert result.stdout == "success"
    assert result.stderr == ""
    assert result.duration_ms == 100


def test_ssh_connection_pool_register_host():
    """Test registering a host in the pool."""
    pool = SSHConnectionPool()
    config = SSHConnectionConfig(host="example.com")
    pool.register_host("test_host", config)
    
    assert "test_host" in pool._configs
    assert pool._configs["test_host"].host == "example.com"
    assert "test_host" in pool._pools


def test_ssh_connection_pool_unregistered_host():
    """Test that getting connection for unregistered host raises error."""
    pool = SSHConnectionPool()
    
    import asyncio
    async def test():
        async with pool.get_connection("unknown_host") as conn:
            pass
    
    with pytest.raises(ValueError, match="not registered"):
        asyncio.run(test())


@pytest.mark.asyncio
async def test_ssh_executor_execute_success():
    """Test SSH executor execute method."""
    pool = SSHConnectionPool()
    config = SSHConnectionConfig(host="example.com")
    pool.register_host("test_host", config)
    
    executor = SSHExecutor(pool)
    
    # Mock the connection
    mock_conn = AsyncMock()
    mock_conn.is_closed.return_value = False
    
    # Mock the run result
    mock_run_result = MagicMock()
    mock_run_result.exit_status = 0
    mock_run_result.stdout = "command output"
    mock_run_result.stderr = ""
    mock_conn.run = AsyncMock(return_value=mock_run_result)
    
    # Patch _create_connection to return our mock
    with patch.object(pool, '_create_connection', return_value=mock_conn):
        result = await executor.execute("test_host", "ls -la", timeout=10)
    
    assert result.exit_code == 0
    assert result.stdout == "command output"
    assert result.stderr == ""
    assert result.duration_ms >= 0


@pytest.mark.asyncio
async def test_ssh_executor_execute_timeout():
    """Test SSH executor timeout handling."""
    import asyncio
    pool = SSHConnectionPool()
    config = SSHConnectionConfig(host="example.com")
    pool.register_host("test_host", config)
    
    executor = SSHExecutor(pool)
    
    # Mock the connection
    mock_conn = AsyncMock()
    mock_conn.is_closed.return_value = False
    
    # Mock run that hangs
    async def slow_run(*args, **kwargs):
        await asyncio.sleep(100)
    
    mock_conn.run = slow_run
    
    with patch.object(pool, '_create_connection', return_value=mock_conn):
        result = await executor.execute("test_host", "sleep 100", timeout=1)
    
    assert result.exit_code == -1
    assert "timed out" in result.stderr


@pytest.mark.asyncio
async def test_ssh_executor_execute_with_cwd():
    """Test SSH executor with working directory."""
    pool = SSHConnectionPool()
    config = SSHConnectionConfig(host="example.com")
    pool.register_host("test_host", config)
    
    executor = SSHExecutor(pool)
    
    mock_conn = AsyncMock()
    mock_conn.is_closed.return_value = False
    
    mock_run_result = MagicMock()
    mock_run_result.exit_status = 0
    mock_run_result.stdout = ""
    mock_run_result.stderr = ""
    mock_conn.run = AsyncMock(return_value=mock_run_result)
    
    with patch.object(pool, '_create_connection', return_value=mock_conn):
        await executor.execute("test_host", "ls", cwd="/opt/app")
    
    # Verify the command was prefixed with cd
    call_args = mock_conn.run.call_args
    assert "cd /opt/app" in call_args[0][0]


@pytest.mark.asyncio
async def test_ssh_executor_execute_with_env():
    """Test SSH executor with environment variables."""
    pool = SSHConnectionPool()
    config = SSHConnectionConfig(host="example.com")
    pool.register_host("test_host", config)
    
    executor = SSHExecutor(pool)
    
    mock_conn = AsyncMock()
    mock_conn.is_closed.return_value = False
    
    mock_run_result = MagicMock()
    mock_run_result.exit_status = 0
    mock_run_result.stdout = ""
    mock_run_result.stderr = ""
    mock_conn.run = AsyncMock(return_value=mock_run_result)
    
    with patch.object(pool, '_create_connection', return_value=mock_conn):
        await executor.execute("test_host", "echo $FOO", env={"FOO": "bar"})
    
    # Verify the command was prefixed with env vars
    call_args = mock_conn.run.call_args
    assert "FOO=bar" in call_args[0][0]


def test_get_ssh_pool_singleton():
    """Test that get_ssh_pool returns a singleton."""
    from app.core.ssh import get_ssh_pool, _ssh_pool
    import app.core.ssh as ssh_module
    
    # Reset the global
    ssh_module._ssh_pool = None
    
    pool1 = get_ssh_pool()
    pool2 = get_ssh_pool()
    
    assert pool1 is pool2
