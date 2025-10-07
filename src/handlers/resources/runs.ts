import { type ProjectRun } from "../../types.js";

// Resources for project management
export const runsList = async (uri: URL, runningProjects: Map<string, ProjectRun>) => {
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
};

// List callback for project stdout template
export const projectStdoutList = (runningProjects: Map<string, ProjectRun>) => async () => {
  const resources = Array.from(runningProjects.keys()).map(runId => ({
    uri: `godot://runs/${runId}/stdout`,
    name: `stdout-${runId}`,
    mimeType: "text/plain"
  }));
  return { resources };
};

export const projectStdout = async (uri: URL, { runId }: any, runningProjects: Map<string, ProjectRun>) => {
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
};

// List callback for project stderr template
export const projectStderrList = (runningProjects: Map<string, ProjectRun>) => async () => {
  const resources = Array.from(runningProjects.keys()).map(runId => ({
    uri: `godot://runs/${runId}/stderr`,
    name: `stderr-${runId}`,
    mimeType: "text/plain"
  }));
  return { resources };
};

export const projectStderr = async (uri: URL, { runId }: any, runningProjects: Map<string, ProjectRun>) => {
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
};

// List callback for project status template
export const projectStatusList = (runningProjects: Map<string, ProjectRun>) => async () => {
  const resources = Array.from(runningProjects.keys()).map(runId => ({
    uri: `godot://runs/${runId}/status`,
    name: `status-${runId}`,
    mimeType: "application/json"
  }));
  return { resources };
};

export const projectStatus = async (uri: URL, { runId }: any, runningProjects: Map<string, ProjectRun>) => {
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
};
