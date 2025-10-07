import { type ProjectRun } from "../../types.js";

export async function stopProject(
  runningProjects: Map<string, ProjectRun>,
  { runId }: { runId: string }
) {
  const projectRun = runningProjects.get(runId);
  if (!projectRun) {
    return {
      content: [{ type: "text" as const, text: `No project found with run ID: ${runId}` }]
    };
  }

  if (projectRun.status === 'exited') {
    return {
      content: [{ type: "text" as const, text: `Project with run ID ${runId} has already exited` }]
    };
  }

  try {
    projectRun.process.kill();
    return {
      content: [{ type: "text" as const, text: `Stopped project with run ID: ${runId}` }]
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: `Failed to stop project ${runId}: ${error}` }]
    };
  }
}
