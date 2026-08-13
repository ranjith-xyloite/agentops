from mcp.server.fastmcp import FastMCP
import sys

print("Starting server...", file=sys.stderr)

mcp = FastMCP("Test")

@mcp.tool()
def hello():
    """Test tool"""
    return "Hello"

print("Tool registered", file=sys.stderr)

if __name__ == "__main__":
    print("Calling mcp.run()", file=sys.stderr)
    mcp.run()
