import type { ProjectRun } from "../../types.js";

export async function callMethod(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    nodePath,
    method,
    args
  }: {
    runId: string;
    nodePath: string;
    method: string;
    args?: unknown[] | undefined;
  }
) {
  const project = runningProjects.get(runId);

  if (!project) {
    return {
      content: [{
        type: "text" as const,
        text: `No project found with run ID: ${runId}`
      }]
    };
  }

  if (project.status === 'exited') {
    return {
      content: [{
        type: "text" as const,
        text: `Project ${runId} has exited`
      }]
    };
  }

  if (!project.bridge || !project.bridgeConnected) {
    return {
      content: [{
        type: "text" as const,
        text: "MCP Bridge addon not connected. Ensure the addon is installed in your Godot project and the project was launched via run_project."
      }]
    };
  }

  if (!project.bridge.hasCapability("nodes")) {
    return {
      content: [{
        type: "text" as const,
        text: "Bridge does not support nodes capability"
      }]
    };
  }

  try {
    const response = await project.bridge.sendRequest<{ result: unknown }>(
      "call_method",
      { path: nodePath, method, args: args ?? [] }
    );

    const resultText = response.result !== undefined
      ? `Result: ${JSON.stringify(response.result, null, 2)}`
      : "Method called successfully (no return value)";

    return {
      content: [{
        type: "text" as const,
        text: resultText
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to call method: ${error}`
      }]
    };
  }
}
