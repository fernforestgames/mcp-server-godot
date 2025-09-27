#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

class GodotMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "mcp-server-godot",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "godot_project_info",
            description: "Get information about a Godot project",
            inputSchema: {
              type: "object",
              properties: {
                project_path: {
                  type: "string",
                  description: "Path to the Godot project directory",
                },
              },
              required: ["project_path"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "godot_project_info":
          return await this.getGodotProjectInfo(args?.["project_path"] as string);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async getGodotProjectInfo(projectPath: string): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      return {
        content: [
          {
            type: "text",
            text: `Godot project analysis for: ${projectPath}\n\nThis is a placeholder implementation. The tool will be enhanced to provide detailed project information.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to analyze Godot project: ${error}`);
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Godot MCP server running on stdio");
  }
}

async function main(): Promise<void> {
  const server = new GodotMCPServer();
  await server.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });
}