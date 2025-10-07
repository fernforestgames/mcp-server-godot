import { ChildProcess } from "child_process";

// Types for project management
export interface ProjectRun {
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
