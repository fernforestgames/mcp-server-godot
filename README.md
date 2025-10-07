# Godot MCP server ![NPM Version](https://img.shields.io/npm/v/%40fernforestgames%2Fmcp-server-godot)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that provides AI assistants with tools to interact with [Godot](https://godotengine.org) projects. This server enables starting, stopping, and capturing output from Godot projects, as well as capturing screenshots for visual debugging and analysis.

## Features

- **Tools**: Run/stop Godot projects, search scenes by node type/name/properties, capture screenshots
- **Resources**: Browse scenes and .tres files, query by resource type, monitor running projects with output streams

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
