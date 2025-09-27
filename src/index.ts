import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";
import * as fs from "fs";
import { Monitor, Window } from "node-screenshots";
import * as path from "path";
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

// Tool to capture screenshot
server.registerTool("capture_screenshot",
  {
    title: "Capture Screenshot",
    description: "Capture a screenshot of the Godot game window or all monitors",
    inputSchema: {
      target: z.enum(["godot", "all_monitors", "primary_monitor"]).optional().describe("Screenshot target: 'godot' for Godot window, 'all_monitors' for all monitors, 'primary_monitor' for primary monitor (default: godot)"),
      format: z.enum(["png", "jpeg", "bmp"]).optional().describe("Image format (default: png)"),
      outputPath: z.string().optional().describe("Optional output file path. If not provided, returns base64 encoded image data")
    }
  },
  async ({ target = "godot", format = "png", outputPath }) => {
    try {
      let imageBuffer: Buffer;
      let screenshotInfo = "";

      if (target === "godot") {
        // Find Godot windows
        const windows = Window.all();
        const godotWindows = windows.filter(window => {
          // Look for Godot-related window titles
          const title = window.title || "";
          return title.toLowerCase().includes("godot") ||
                 title.toLowerCase().includes("game") ||
                 title.includes("Godot_") ||
                 title.includes("Engine");
        });

        if (godotWindows.length === 0) {
          return {
            content: [{ type: "text", text: "No Godot windows found. Available windows:\n" +
              windows.map(w => `- ${w.title || 'Untitled'} (${w.width}x${w.height})`).join("\n") }]
          };
        }

        // Use the first Godot window found
        const godotWindow = godotWindows[0];
        if (!godotWindow) {
          return {
            content: [{ type: "text", text: "No Godot window available for capture" }]
          };
        }
        const image = godotWindow.captureImageSync();

        switch (format) {
          case "png":
            imageBuffer = image.toPngSync();
            break;
          case "jpeg":
            imageBuffer = image.toJpegSync();
            break;
          case "bmp":
            imageBuffer = image.toBmpSync();
            break;
        }

        screenshotInfo = `Captured Godot window: ${godotWindow.title || 'Untitled'} (${godotWindow.width}x${godotWindow.height})`;
      } else if (target === "all_monitors") {
        const monitors = Monitor.all();
        if (monitors.length === 0) {
          return {
            content: [{ type: "text", text: "No monitors found" }]
          };
        }

        // Capture primary monitor for now (could be extended to capture all)
        const primaryMonitor = monitors.find(m => m.isPrimary) || monitors[0];
        if (!primaryMonitor) {
          return {
            content: [{ type: "text", text: "No primary monitor found" }]
          };
        }
        const image = primaryMonitor.captureImageSync();

        switch (format) {
          case "png":
            imageBuffer = image.toPngSync();
            break;
          case "jpeg":
            imageBuffer = image.toJpegSync();
            break;
          case "bmp":
            imageBuffer = image.toBmpSync();
            break;
        }

        screenshotInfo = `Captured primary monitor (${primaryMonitor.width}x${primaryMonitor.height})`;
      } else { // primary_monitor
        const monitors = Monitor.all();
        const primaryMonitor = monitors.find(m => m.isPrimary) || monitors[0];

        if (!primaryMonitor) {
          return {
            content: [{ type: "text", text: "No primary monitor found" }]
          };
        }

        const image = primaryMonitor.captureImageSync();

        switch (format) {
          case "png":
            imageBuffer = image.toPngSync();
            break;
          case "jpeg":
            imageBuffer = image.toJpegSync();
            break;
          case "bmp":
            imageBuffer = image.toBmpSync();
            break;
        }

        screenshotInfo = `Captured primary monitor (${primaryMonitor.width}x${primaryMonitor.height})`;
      }

      if (outputPath) {
        // Save to file
        const resolvedPath = path.resolve(outputPath);
        fs.writeFileSync(resolvedPath, imageBuffer);
        return {
          content: [{ type: "text", text: `${screenshotInfo}\nScreenshot saved to: ${resolvedPath}` }]
        };
      } else {
        // Return base64 encoded data
        const base64Data = imageBuffer.toString('base64');
        return {
          content: [{
            type: "image",
            data: base64Data,
            mimeType: `image/${format}`,
          }]
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to capture screenshot: ${error}` }]
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

server.registerResource("project_stdout", new ResourceTemplate("godot://runs/{runId}/stdout", {
  list: async () => {
    const resources = Array.from(runningProjects.keys()).map(runId => ({
      uri: `godot://runs/${runId}/stdout`,
      name: `stdout-${runId}`,
      mimeType: "text/plain"
    }));
    return { resources };
  }
}),
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

server.registerResource("project_stderr", new ResourceTemplate("godot://runs/{runId}/stderr", {
  list: async () => {
    const resources = Array.from(runningProjects.keys()).map(runId => ({
      uri: `godot://runs/${runId}/stderr`,
      name: `stderr-${runId}`,
      mimeType: "text/plain"
    }));
    return { resources };
  }
}),
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

server.registerResource("project_status", new ResourceTemplate("godot://runs/{runId}/status", {
  list: async () => {
    const resources = Array.from(runningProjects.keys()).map(runId => ({
      uri: `godot://runs/${runId}/status`,
      name: `status-${runId}`,
      mimeType: "application/json"
    }));
    return { resources };
  }
}),
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
