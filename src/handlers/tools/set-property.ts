import type { ProjectRun } from "../../types.js";

export async function setProperty(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    nodePath,
    property,
    value
  }: {
    runId: string;
    nodePath: string;
    property: string;
    value?: unknown;
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
    await project.bridge.sendRequest<{ success: boolean }>(
      "set_property",
      { path: nodePath, property, value }
    );

    return {
      content: [{
        type: "text" as const,
        text: `Property '${property}' set successfully on node '${nodePath}'`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to set property: ${error}`
      }]
    };
  }
}
