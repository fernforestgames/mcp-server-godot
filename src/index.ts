import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChildProcess, spawn } from "child_process";
import { z } from "zod";

// Get Godot project path from command line arguments
const projectPath = process.argv[2];
if (!projectPath) {
  console.error("Error: Godot project path must be provided as a command line argument");
  process.exit(1);
}

// Get Godot executable path from environment variable
const godotPath = process.env['GODOT_PATH'];
if (!godotPath) {
  console.error("Error: GODOT_PATH environment variable must be set");
  process.exit(1);
}

const server = new McpServer({
  name: "mcp-server-godot",
  version: "0.1.0",
});

let godotProcess: ChildProcess | null = null;
let consoleOutput: string[] = [];

// Tool to launch Godot project
server.registerTool("launch_godot",
  {
    title: "Launch Godot Project",
    description: "Launch the specified Godot project and begin capturing console output",
    inputSchema: {}
  },
  async () => {
    if (godotProcess) {
      return {
        content: [{ type: "text", text: "Godot project is already running" }]
      };
    }

    try {
      godotProcess = spawn(godotPath, ["--path", projectPath], {
        stdio: ["inherit", "pipe", "pipe"]
      });

      // Capture stdout
      godotProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        consoleOutput.push(`[STDOUT] ${output}`);
      });

      // Capture stderr
      godotProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        consoleOutput.push(`[STDERR] ${output}`);
      });

      // Handle process exit
      godotProcess.on("exit", (code) => {
        consoleOutput.push(`[SYSTEM] Godot process exited with code: ${code}`);
        godotProcess = null;
      });

      // Handle process errors
      godotProcess.on("error", (error) => {
        consoleOutput.push(`[ERROR] Failed to start Godot: ${error.message}`);
        godotProcess = null;
      });

      return {
        content: [{ type: "text", text: `Godot project launched from: ${projectPath}` }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to launch Godot: ${error}` }]
      };
    }
  }
);

// Tool to get console output
server.registerTool("get_console_output",
  {
    title: "Get Console Output",
    description: "Retrieve the captured console output from the Godot process",
    inputSchema: {
      lines: z.number().optional().describe("Number of recent lines to return (default: all)")
    }
  },
  async ({ lines }) => {
    if (consoleOutput.length === 0) {
      return {
        content: [{ type: "text", text: "No console output available" }]
      };
    }

    const outputToReturn = lines ? consoleOutput.slice(-lines) : consoleOutput;
    return {
      content: [{ type: "text", text: outputToReturn.join("") }]
    };
  }
);

// Tool to stop Godot process
server.registerTool("stop_godot",
  {
    title: "Stop Godot Project",
    description: "Stop the running Godot process",
    inputSchema: {}
  },
  async () => {
    if (!godotProcess) {
      return {
        content: [{ type: "text", text: "No Godot process is currently running" }]
      };
    }

    try {
      godotProcess.kill();
      return {
        content: [{ type: "text", text: "Godot process stopped" }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to stop Godot process: ${error}` }]
      };
    }
  }
);

// Tool to clear console output
server.registerTool("clear_console",
  {
    title: "Clear Console Output",
    description: "Clear the captured console output buffer",
    inputSchema: {}
  },
  async () => {
    consoleOutput = [];
    return {
      content: [{ type: "text", text: "Console output cleared" }]
    };
  }
);

// Clean up on process exit
process.on("exit", () => {
  if (godotProcess) {
    godotProcess.kill();
  }
});

process.on("SIGINT", () => {
  if (godotProcess) {
    godotProcess.kill();
  }
  process.exit(0);
});

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
