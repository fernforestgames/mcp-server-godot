# Godot MCP server ![NPM Version](https://img.shields.io/npm/v/%40fernforestgames%2Fmcp-server-godot)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that provides AI assistants with tools to interact with [Godot](https://godotengine.org) projects. This server enables starting, stopping, and capturing output from Godot projects, as well as capturing screenshots for visual debugging and analysis.

## Features

- Tools to run, stop, and capture screenshots from Godot projects
- Resources to monitor running projects, access output streams, and check exit status

## Prerequisites

- Node 22+
- Godot must be installed and accessible
- `GODOT_PATH` environment variable must be configured

## MCP configuration

Add this server to your `.mcp.json`:

```json
{
  "mcpServers": {
    "godot": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@fernforestgames/mcp-server-godot",
        "/path/to/your/godot/project"
      ],
      "env": {
        "GODOT_PATH": "/path/to/godot/executable"
      }
    }
  }
}
```

## License

Released under the MIT License. See the [LICENSE](LICENSE) file for details.
