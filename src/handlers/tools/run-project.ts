import { type ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";
import { godotPath, projectPath as defaultProjectPath } from "../../config.js";
import { type ProjectRun } from "../../types.js";
import { BridgeClient } from "../../bridge/bridge-client.js";

export async function runProject(
  runningProjects: Map<string, ProjectRun>,
  { projectPath: customProjectPath, args }: { projectPath?: string | undefined; args?: string[] | undefined }
) {
  const targetProjectPath = customProjectPath || defaultProjectPath;
  if (!targetProjectPath) {
    return {
      content: [{ type: "text" as const, text: "Project path is not defined" }]
    };
  }

  const runId = randomUUID();

  try {
    // Add --mcp-bridge flag to enable bridge communication
    const godotArgs = ["--path", targetProjectPath, "--mcp-bridge"];
    if (args) {
      godotArgs.push(...args);
    }

    if (!godotPath) {
      return {
        content: [{ type: "text" as const, text: "GODOT_PATH environment variable is not set" }]
      };
    }

    // Use pipe for stdin to enable bidirectional communication
    const process: ChildProcess = spawn(godotPath, godotArgs, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    // Create bridge client
    const bridge = new BridgeClient(process);

    const projectRun: ProjectRun = {
      id: runId,
      process,
      projectPath: targetProjectPath,
      stdout: [],
      stderr: [],
      status: 'running',
      startTime: new Date(),
      bridge,
      bridgeConnected: false,
      ...(args && { args })
    };

    runningProjects.set(runId, projectRun);

    // Bridge client filters stdout - non-bridge text is emitted as 'stdout' event
    bridge.on("stdout", (text) => {
      projectRun.stdout.push(text);
    });

    // Capture stderr directly
    process.stderr?.on("data", (data) => {
      const output = data.toString();
      projectRun.stderr.push(output);
    });

    // Handle process exit
    process.on("exit", (code) => {
      projectRun.status = 'exited';
      projectRun.exitCode = code || 0;
      projectRun.bridgeConnected = false;
    });

    // Handle process errors
    process.on("error", (error) => {
      projectRun.stderr.push(`Failed to start Godot: ${error.message}`);
      projectRun.status = 'exited';
      projectRun.exitCode = 1;
      projectRun.bridgeConnected = false;
    });

    // Attempt bridge handshake after a short delay to allow Godot to initialize
    setTimeout(async () => {
      try {
        const connected = await bridge.handshake(3000);
        projectRun.bridgeConnected = connected;
        if (connected) {
          console.error(`[MCP Bridge] Connected to addon v${bridge.version}, capabilities: ${bridge.capabilities.join(", ")}`);
        }
      } catch (error) {
        // Handshake failed - addon likely not installed, which is fine
        projectRun.bridgeConnected = false;
      }
    }, 500);

    return {
      content: [{ type: "text" as const, text: `Godot project started with run ID: ${runId}\nProject path: ${targetProjectPath}` }]
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: `Failed to launch Godot: ${error}` }]
    };
  }
}
