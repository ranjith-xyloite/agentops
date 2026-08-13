from app.tools.registry import get_tool

def test_get_tool_allowlist():
    assert get_tool("deploy_frontend") is not None
    assert get_tool("nonexistent_tool") is None
