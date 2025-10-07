import { type ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";
import { godotPath, projectPath as defaultProjectPath } from "../../config.js";
import { type ProjectRun } from "../../types.js";

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
    const godotArgs = ["--path", targetProjectPath];
    if (args) {
      godotArgs.push(...args);
    }

    if (!godotPath) {
      return {
        content: [{ type: "text" as const, text: "GODOT_PATH environment variable is not set" }]
      };
    }

    const process: ChildProcess = spawn(godotPath, godotArgs, {
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
      content: [{ type: "text" as const, text: `Godot project started with run ID: ${runId}\nProject path: ${targetProjectPath}` }]
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: `Failed to launch Godot: ${error}` }]
    };
  }
}
