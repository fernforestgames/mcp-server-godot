import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChildProcess, spawn } from "child_process";
import { z } from "zod";
import { randomUUID } from "crypto";

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

// Types for project management
interface ProjectRun {
  id: string;
  process: ChildProcess;
  projectPath: string;
  stdout: string[];
  stderr: string[];
  status: 'running' | 'exited';
  exitCode?: number;
  startTime: Date;
  args?: string[];
}

// Storage for running projects
const runningProjects = new Map<string, ProjectRun>();

// Tool to run a Godot project
server.registerTool("run_project",
  {
    title: "Run Godot Project",
    description: "Start a Godot project and return a run ID for managing it",
    inputSchema: {
      projectPath: z.string().optional().describe("Path to the Godot project (defaults to command line argument)"),
      args: z.array(z.string()).optional().describe("Optional arguments to pass to Godot on startup")
    }
  },
  async ({ projectPath: customProjectPath, args }) => {
    const targetProjectPath = customProjectPath || projectPath;
    const runId = randomUUID();

    try {
      const godotArgs = ["--path", targetProjectPath];
      if (args) {
        godotArgs.push(...args);
      }

      const process = spawn(godotPath, godotArgs, {
        stdio: ["inherit", "pipe", "pipe"]
      });

      const projectRun: ProjectRun = {
        id: runId,
        process,
        projectPath: targetProjectPath,
        stdout: [],
        stderr: [],
        status: 'running',
        startTime: new Date(),
        ...(args && { args })
      };

      runningProjects.set(runId, projectRun);

      // Capture stdout
      process.stdout?.on("data", (data) => {
        const output = data.toString();
        projectRun.stdout.push(output);
      });

      // Capture stderr
      process.stderr?.on("data", (data) => {
        const output = data.toString();
        projectRun.stderr.push(output);
      });

      // Handle process exit
      process.on("exit", (code) => {
        projectRun.status = 'exited';
        projectRun.exitCode = code || 0;
      });

      // Handle process errors
      process.on("error", (error) => {
        projectRun.stderr.push(`Failed to start Godot: ${error.message}`);
        projectRun.status = 'exited';
        projectRun.exitCode = 1;
      });

      return {
        content: [{ type: "text", text: `Godot project started with run ID: ${runId}\nProject path: ${targetProjectPath}` }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to launch Godot: ${error}` }]
      };
    }
  }
);

// Tool to stop a Godot project
server.registerTool("stop_project",
  {
    title: "Stop Godot Project",
    description: "Stop a running Godot project by its run ID",
    inputSchema: {
      runId: z.string().describe("The run ID of the project to stop")
    }
  },
  async ({ runId }) => {
    const projectRun = runningProjects.get(runId);
    if (!projectRun) {
      return {
        content: [{ type: "text", text: `No project found with run ID: ${runId}` }]
      };
    }

    if (projectRun.status === 'exited') {
      return {
        content: [{ type: "text", text: `Project with run ID ${runId} has already exited` }]
      };
    }

    try {
      projectRun.process.kill();
      return {
        content: [{ type: "text", text: `Stopped project with run ID: ${runId}` }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to stop project ${runId}: ${error}` }]
      };
    }
  }
);

// Resources for project management
server.registerResource("runs_list", "godot://runs/",
  {
    title: "Running Projects",
    description: "List all currently running Godot projects",
    mimeType: "application/json"
  },
  async (uri) => {
    const runs = Array.from(runningProjects.values()).map(run => ({
      id: run.id,
      projectPath: run.projectPath,
      status: run.status,
      startTime: run.startTime.toISOString(),
      exitCode: run.exitCode,
      args: run.args
    }));

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(runs, null, 2)
      }]
    };
  }
);

server.registerResource("project_stdout", new ResourceTemplate("godot://runs/{runId}/stdout", { list: undefined }),
  {
    title: "Project Standard Output",
    description: "Get the standard output for a specific project run",
    mimeType: "text/plain"
  },
  async (uri, { runId }) => {
    const projectRun = runningProjects.get(runId as string);

    if (!projectRun) {
      throw new Error(`No project found with run ID: ${runId}`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: projectRun.stdout.join('')
      }]
    };
  }
);

server.registerResource("project_stderr", new ResourceTemplate("godot://runs/{runId}/stderr", { list: undefined }),
  {
    title: "Project Standard Error",
    description: "Get the standard error for a specific project run",
    mimeType: "text/plain"
  },
  async (uri, { runId }) => {
    const projectRun = runningProjects.get(runId as string);

    if (!projectRun) {
      throw new Error(`No project found with run ID: ${runId}`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: projectRun.stderr.join('')
      }]
    };
  }
);

server.registerResource("project_status", new ResourceTemplate("godot://runs/{runId}/status", { list: undefined }),
  {
    title: "Project Status",
    description: "Get the status information for a specific project run",
    mimeType: "application/json"
  },
  async (uri, { runId }) => {
    const projectRun = runningProjects.get(runId as string);

    if (!projectRun) {
      throw new Error(`No project found with run ID: ${runId}`);
    }

    const status = {
      id: projectRun.id,
      status: projectRun.status,
      projectPath: projectRun.projectPath,
      startTime: projectRun.startTime.toISOString(),
      exitCode: projectRun.exitCode,
      args: projectRun.args
    };

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(status, null, 2)
      }]
    };
  }
);


// Clean up on process exit
process.on("exit", () => {
  for (const projectRun of runningProjects.values()) {
    if (projectRun.status === 'running') {
      projectRun.process.kill();
    }
  }
});

process.on("SIGINT", () => {
  for (const projectRun of runningProjects.values()) {
    if (projectRun.status === 'running') {
      projectRun.process.kill();
    }
  }
  process.exit(0);
});

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
