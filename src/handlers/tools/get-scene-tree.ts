import type { ProjectRun } from "../../types.js";
import type { NodeInfo } from "../../bridge/types.js";

export async function getSceneTree(
  runningProjects: Map<string, ProjectRun>,
  { runId }: { runId: string }
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
    const response = await project.bridge.sendRequest<{ root: NodeInfo }>(
      "get_scene_tree",
      {}
    );

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(response.root, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to get scene tree: ${error}`
      }]
    };
  }
}
