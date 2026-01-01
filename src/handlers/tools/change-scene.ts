import type { ProjectRun } from "../../types.js";

export async function changeScene(
  runningProjects: Map<string, ProjectRun>,
  { runId, scenePath }: { runId: string; scenePath: string }
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

  if (!project.bridge.hasCapability("scene")) {
    return {
      content: [{
        type: "text" as const,
        text: "Bridge does not support scene capability"
      }]
    };
  }

  try {
    await project.bridge.sendRequest<{ success: boolean }>(
      "change_scene",
      { scenePath }
    );

    return {
      content: [{
        type: "text" as const,
        text: `Scene changed to: ${scenePath}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to change scene: ${error}`
      }]
    };
  }
}
