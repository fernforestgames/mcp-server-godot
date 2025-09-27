# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript MCP (Model Context Protocol) server for Godot game engine integration. The server implements the MCP specification to provide tools that can interact with Godot projects through the MCP protocol.

## Essential Commands

**Development:**
```bash
npm run dev          # Watch mode compilation
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server
```

**Quality Assurance:**
```bash
npm run lint         # ESLint with TypeScript support
```

**All commands run automatically in CI via GitHub Actions on pushes to main.**

## MCP SDK Implementation Notes

**Resource Registration:**
- Static resources: `server.registerResource(name, uri, metadata, callback)`
- Dynamic resources with URI templates: `server.registerResource(name, new ResourceTemplate(uriTemplate, { list: undefined }), metadata, callback)`
- Resource callbacks must return `{ contents: [{ uri: uri.href, text: string }] }`
- Template variables are passed as second parameter: `async (uri, { variableName }) => {}`

**Tool Registration:**
- Use `server.registerTool(name, { title, description, inputSchema }, callback)`
- Input schema uses Zod validators: `{ paramName: z.string().optional().describe("...") }`
- Tool callbacks return `{ content: [{ type: "text", text: string }] }`

**TypeScript Considerations:**
- Import ResourceTemplate: `import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"`
- Optional properties in interfaces must use conditional spreading: `...(args && { args })`
- Resource template callbacks are strongly typed with variable destructuring

**Project Architecture:**
- Multi-project support using Map<string, ProjectRun> with UUID run IDs
- Separate stdout/stderr capture per project instance
- Process lifecycle tracking (running/exited status with exit codes)
- Proper cleanup on server shutdown for all running processes
- Environment variable $GODOT_PATH contains the path to the `godot` executable