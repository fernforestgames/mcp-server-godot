import * as fs from "fs";
import { Monitor, Window } from "node-screenshots";
import * as path from "path";

export async function captureScreenshot({
  target = "godot",
  format = "png",
  outputPath
}: {
  target?: "godot" | "all_monitors" | "primary_monitor" | undefined;
  format?: "png" | "jpeg" | "bmp" | undefined;
  outputPath?: string | undefined;
}) {
  try {
    let imageBuffer: Buffer;
    let screenshotInfo = "";

    if (target === "godot") {
      // Find Godot windows
      const windows = Window.all();
      const godotWindows = windows.filter(window => {
        // Look for Godot application by app name instead of title
        const appName = window.appName || "";
        return appName.toLowerCase().includes("godot");
      });

      if (godotWindows.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No Godot windows found. Available windows:\n" +
            windows.map(w => `- ${w.title || 'Untitled'} [${w.appName || 'Unknown'}] (${w.width}x${w.height})`).join("\n") }]
        };
      }

      // Use the first Godot window found
      const godotWindow = godotWindows[0];
      if (!godotWindow) {
        return {
          content: [{ type: "text" as const, text: "No Godot window available for capture" }]
        };
      }
      const image = godotWindow.captureImageSync();

      switch (format) {
        case "png":
          imageBuffer = image.toPngSync();
          break;
        case "jpeg":
          imageBuffer = image.toJpegSync();
          break;
        case "bmp":
          imageBuffer = image.toBmpSync();
          break;
      }

      screenshotInfo = `Captured Godot window: ${godotWindow.title || 'Untitled'} (${godotWindow.width}x${godotWindow.height})`;
    } else if (target === "all_monitors") {
      const monitors = Monitor.all();
      if (monitors.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No monitors found" }]
        };
      }

      // Capture primary monitor for now (could be extended to capture all)
      const primaryMonitor = monitors.find(m => m.isPrimary) || monitors[0];
      if (!primaryMonitor) {
        return {
          content: [{ type: "text" as const, text: "No primary monitor found" }]
        };
      }
      const image = primaryMonitor.captureImageSync();

      switch (format) {
        case "png":
          imageBuffer = image.toPngSync();
          break;
        case "jpeg":
          imageBuffer = image.toJpegSync();
          break;
        case "bmp":
          imageBuffer = image.toBmpSync();
          break;
      }

      screenshotInfo = `Captured primary monitor (${primaryMonitor.width}x${primaryMonitor.height})`;
    } else { // primary_monitor
      const monitors = Monitor.all();
      const primaryMonitor = monitors.find(m => m.isPrimary) || monitors[0];

      if (!primaryMonitor) {
        return {
          content: [{ type: "text" as const, text: "No primary monitor found" }]
        };
      }

      const image = primaryMonitor.captureImageSync();

      switch (format) {
        case "png":
          imageBuffer = image.toPngSync();
          break;
        case "jpeg":
          imageBuffer = image.toJpegSync();
          break;
        case "bmp":
          imageBuffer = image.toBmpSync();
          break;
      }

      screenshotInfo = `Captured primary monitor (${primaryMonitor.width}x${primaryMonitor.height})`;
    }

    if (outputPath) {
      // Save to file
      const resolvedPath = path.resolve(outputPath);
      fs.writeFileSync(resolvedPath, imageBuffer);
      return {
        content: [{ type: "text" as const, text: `${screenshotInfo}\nScreenshot saved to: ${resolvedPath}` }]
      };
    } else {
      // Return base64 encoded data
      const base64Data = imageBuffer.toString('base64');
      return {
        content: [{
          type: "image" as const,
          data: base64Data,
          mimeType: `image/${format}`,
        }]
      };
    }
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: `Failed to capture screenshot: ${error}` }]
    };
  }
}
