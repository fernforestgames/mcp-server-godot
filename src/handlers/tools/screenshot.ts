import * as fs from "fs";
import * as path from "path";
import type { ProjectRun } from "../../types.js";
import type { ScreenshotResponse } from "../../bridge/types.js";

export async function captureScreenshot(
  runningProjects: Map<string, ProjectRun>,
  {
    runId,
    format = "png",
    outputPath
  }: {
    runId: string;
    format?: "png" | "jpeg" | undefined;
    outputPath?: string | undefined;
  }
) {
  try {
    // Find the project
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

    if (!project.bridge.hasCapability("screenshot")) {
      return {
        content: [{
          type: "text" as const,
          text: "Bridge does not support screenshot capability"
        }]
      };
    }

    // Request screenshot from bridge
    const response = await project.bridge.sendRequest<ScreenshotResponse>(
      "screenshot",
      { format },
      10000 // 10 second timeout for screenshot
    );

    const screenshotInfo = `Captured viewport (${response.width}x${response.height})`;

    if (outputPath) {
      // Save to file
      const resolvedPath = path.resolve(outputPath);
      const buffer = Buffer.from(response.data, 'base64');
      fs.writeFileSync(resolvedPath, buffer);
      return {
        content: [{
          type: "text" as const,
          text: `${screenshotInfo}\nScreenshot saved to: ${resolvedPath}`
        }]
      };
    } else {
      // Return base64 encoded data
      return {
        content: [{
          type: "image" as const,
          data: response.data,
          mimeType: `image/${format}`,
        }]
      };
    }
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: `Failed to capture screenshot: ${error}`
      }]
    };
  }
}
