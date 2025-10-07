#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";
import * as fs from "fs";
import { Monitor, Window } from "node-screenshots";
import * as path from "path";
import { z } from "zod";
import { parse, isGodotScene, isGodotResource, type GodotScene, type GodotResource, type Node as GodotNode } from "@fernforestgames/godot-resource-parser/dist/index.js";

// Get Godot project path from command line arguments
const projectPath = process.argv[2];
if (!projectPath) {
  console.error("Error: Godot project path must be provided as a command line argument");
  process.exit(1);
}

// Get Godot executable path from environment variable
const godotPath = process.env['GODOT_PATH'];
if (!godotPath) {
  console.error("Error: GODOT_PATH environment variable must be set");
  process.exit(1);
}

const server = new McpServer({
  name: "mcp-server-godot",
  version: "0.1.0",
});

// Types for project management
interface ProjectRun {
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

// Storage for running projects
const runningProjects = new Map<string, ProjectRun>();

// Helper functions for file discovery
function findGodotFiles(directory: string | undefined, extension: string): string[] {
  if (!directory) {
    return [];
  }

  const rootDir = directory; // Capture in const to satisfy TypeScript
  const results: string[] = [];

  function searchDir(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories and common non-project directories
          if (!entry.name.startsWith('.') && entry.name !== 'addons') {
            searchDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          // Return path relative to project root
          const relativePath = path.relative(rootDir, fullPath);
          results.push(relativePath.replace(/\\/g, '/'));
        }
      }
    } catch (_error) {
      // Skip directories we can't read
    }
  }

  searchDir(rootDir);
  return results;
}

function parseGodotFile(filePath: string): GodotScene | GodotResource {
  if (!projectPath) {
    throw new Error("Project path is not defined");
  }
  const fullPath = path.join(projectPath, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return parse(content);
}

function getNodeByPath(scene: GodotScene, nodePath: string): GodotNode | undefined {
  // Node path is like "." for root, "Player" for child, "Player/Sprite" for nested
  if (nodePath === ".") {
    return scene.nodes.find((node: GodotNode) => !node.parent || node.parent === ".");
  }

  return scene.nodes.find((node: GodotNode) => {
    if (node.parent === ".") {
      return node.name === nodePath;
    }
    // For nested nodes, construct full path
    const fullNodePath = getFullNodePath(scene, node);
    return fullNodePath === nodePath;
  });
}

function getFullNodePath(scene: GodotScene, node: GodotNode): string {
  if (!node.parent || node.parent === ".") {
    return node.name;
  }

  const parentNode = scene.nodes.find((n: GodotNode) => n.name === node.parent);
  if (!parentNode) {
    return node.name;
  }

  return `${getFullNodePath(scene, parentNode)}/${node.name}`;
}

// Tool to run a Godot project
server.registerTool("run_project",
  {
    title: "Run Godot Project",
    description: "Start a Godot project and return a run ID for managing it",
    inputSchema: {
      projectPath: z.string().optional().describe("Path to the Godot project (defaults to command line argument)"),
      args: z.array(z.string()).optional().describe("Optional arguments to pass to Godot on startup")
    }
  },
  async ({ projectPath: customProjectPath, args }) => {
    const targetProjectPath = customProjectPath || projectPath;
    const runId = randomUUID();

    try {
      const godotArgs = ["--path", targetProjectPath];
      if (args) {
        godotArgs.push(...args);
      }

      const process = spawn(godotPath, godotArgs, {
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
        content: [{ type: "text", text: `Godot project started with run ID: ${runId}\nProject path: ${targetProjectPath}` }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to launch Godot: ${error}` }]
      };
    }
  }
);

// Tool to stop a Godot project
server.registerTool("stop_project",
  {
    title: "Stop Godot Project",
    description: "Stop a running Godot project by its run ID",
    inputSchema: {
      runId: z.string().describe("The run ID of the project to stop")
    }
  },
  async ({ runId }) => {
    const projectRun = runningProjects.get(runId);
    if (!projectRun) {
      return {
        content: [{ type: "text", text: `No project found with run ID: ${runId}` }]
      };
    }

    if (projectRun.status === 'exited') {
      return {
        content: [{ type: "text", text: `Project with run ID ${runId} has already exited` }]
      };
    }

    try {
      projectRun.process.kill();
      return {
        content: [{ type: "text", text: `Stopped project with run ID: ${runId}` }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to stop project ${runId}: ${error}` }]
      };
    }
  }
);

// Tool to search scenes
server.registerTool("search_scenes",
  {
    title: "Search Scenes",
    description: "Find nodes or scenes matching criteria (by node type, name pattern, or property)",
    inputSchema: {
      nodeType: z.string().optional().describe("Filter by node type (e.g., 'CharacterBody2D')"),
      namePattern: z.string().optional().describe("Filter by name pattern (case-insensitive substring match)"),
      propertyName: z.string().optional().describe("Filter by nodes that have a specific property"),
      propertyValue: z.string().optional().describe("Filter by nodes where property has a specific value (requires propertyName)"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 100)"),
      offset: z.number().optional().describe("Number of results to skip for pagination (default: 0)")
    }
  },
  async ({ nodeType, namePattern, propertyName, propertyValue, limit = 100, offset = 0 }) => {
    const scenes = findGodotFiles(projectPath, '.tscn');
    const results: Array<{ scene: string; node: string; type: string; properties?: Record<string, unknown> }> = [];

    for (const scenePath of scenes) {
      try {
        const parsed = parseGodotFile(scenePath);
        if (!isGodotScene(parsed)) continue;

        for (const node of parsed.nodes) {
          let matches = true;

          // Filter by node type
          if (nodeType && node.type !== nodeType) {
            matches = false;
          }

          // Filter by name pattern (case-insensitive)
          if (namePattern && !node.name.toLowerCase().includes(namePattern.toLowerCase())) {
            matches = false;
          }

          // Filter by property name
          if (propertyName && !(propertyName in node.properties)) {
            matches = false;
          }

          // Filter by property value
          if (propertyValue && propertyName) {
            const propValue = node.properties[propertyName];
            if (propValue !== propertyValue && String(propValue) !== propertyValue) {
              matches = false;
            }
          }

          if (matches) {
            results.push({
              scene: scenePath,
              node: getFullNodePath(parsed, node),
              type: node.type,
              ...(Object.keys(node.properties).length > 0 && { properties: node.properties })
            });
          }
        }
      } catch (_error) {
        // Skip scenes we can't parse
      }
    }

    const totalResults = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = (offset + limit) < totalResults;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          results: paginatedResults,
          pagination: {
            total: totalResults,
            offset,
            limit,
            returned: paginatedResults.length,
            hasMore
          }
        }, null, 2)
      }]
    };
  }
);

// Tool to capture screenshot
server.registerTool("capture_screenshot",
  {
    title: "Capture Screenshot",
    description: "Capture a screenshot of the Godot game window or all monitors",
    inputSchema: {
      target: z.enum(["godot", "all_monitors", "primary_monitor"]).optional().describe("Screenshot target: 'godot' for Godot window, 'all_monitors' for all monitors, 'primary_monitor' for primary monitor (default: godot)"),
      format: z.enum(["png", "jpeg", "bmp"]).optional().describe("Image format (default: png)"),
      outputPath: z.string().optional().describe("Optional output file path. If not provided, returns base64 encoded image data")
    }
  },
  async ({ target = "godot", format = "png", outputPath }) => {
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
            content: [{ type: "text", text: "No Godot windows found. Available windows:\n" +
              windows.map(w => `- ${w.title || 'Untitled'} [${w.appName || 'Unknown'}] (${w.width}x${w.height})`).join("\n") }]
          };
        }

        // Use the first Godot window found
        const godotWindow = godotWindows[0];
        if (!godotWindow) {
          return {
            content: [{ type: "text", text: "No Godot window available for capture" }]
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
            content: [{ type: "text", text: "No monitors found" }]
          };
        }

        // Capture primary monitor for now (could be extended to capture all)
        const primaryMonitor = monitors.find(m => m.isPrimary) || monitors[0];
        if (!primaryMonitor) {
          return {
            content: [{ type: "text", text: "No primary monitor found" }]
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
            content: [{ type: "text", text: "No primary monitor found" }]
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
          content: [{ type: "text", text: `${screenshotInfo}\nScreenshot saved to: ${resolvedPath}` }]
        };
      } else {
        // Return base64 encoded data
        const base64Data = imageBuffer.toString('base64');
        return {
          content: [{
            type: "image",
            data: base64Data,
            mimeType: `image/${format}`,
          }]
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to capture screenshot: ${error}` }]
      };
    }
  }
);

// Scene structure resources
server.registerResource("scenes_list", "godot://project/scenes/",
  {
    title: "Project Scenes",
    description: "List all .tscn scene files in the Godot project",
    mimeType: "application/json"
  },
  async (uri) => {
    const scenes = findGodotFiles(projectPath, '.tscn');

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(scenes, null, 2)
      }]
    };
  }
);

server.registerResource("scene_data", new ResourceTemplate("godot://project/scenes/{scenePath...}", {
  list: async () => {
    const scenes = findGodotFiles(projectPath, '.tscn');
    const resources = scenes.map(scenePath => ({
      uri: `godot://project/scenes/${scenePath}`,
      name: `scene-${scenePath}`,
      mimeType: "application/json"
    }));
    return { resources };
  }
}),
  {
    title: "Scene Data",
    description: "Get full parsed scene data including nodes, connections, and resources",
    mimeType: "application/json"
  },
  async (uri, { scenePath }) => {
    const scenePathStr = (scenePath as string[]).join('/');
    const parsed = parseGodotFile(scenePathStr);

    if (!isGodotScene(parsed)) {
      throw new Error(`File ${scenePathStr} is not a scene file`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(parsed, null, 2)
      }]
    };
  }
);

server.registerResource("scene_nodes", new ResourceTemplate("godot://project/scenes/{scenePath...}/nodes", {
  list: async () => {
    const scenes = findGodotFiles(projectPath, '.tscn');
    const resources = scenes.map(scenePath => ({
      uri: `godot://project/scenes/${scenePath}/nodes`,
      name: `nodes-${scenePath}`,
      mimeType: "application/json"
    }));
    return { resources };
  }
}),
  {
    title: "Scene Node Hierarchy",
    description: "Get the node hierarchy with names, types, and parent relationships",
    mimeType: "application/json"
  },
  async (uri, { scenePath }) => {
    const scenePathStr = (scenePath as string[]).join('/');
    const parsed = parseGodotFile(scenePathStr);

    if (!isGodotScene(parsed)) {
      throw new Error(`File ${scenePathStr} is not a scene file`);
    }

    const nodeHierarchy = parsed.nodes.map((node: GodotNode) => ({
      name: node.name,
      type: node.type,
      parent: node.parent,
      fullPath: getFullNodePath(parsed, node),
      hasProperties: Object.keys(node.properties).length > 0
    }));

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(nodeHierarchy, null, 2)
      }]
    };
  }
);

server.registerResource("scene_node_detail", new ResourceTemplate("godot://project/scenes/{scenePath...}/nodes/{nodePath...}", {
  list: undefined
}),
  {
    title: "Scene Node Details",
    description: "Get detailed information about a specific node including all properties",
    mimeType: "application/json"
  },
  async (uri, { scenePath, nodePath }) => {
    const scenePathStr = (scenePath as string[]).join('/');
    const nodePathStr = (nodePath as string[]).join('/');
    const parsed = parseGodotFile(scenePathStr);

    if (!isGodotScene(parsed)) {
      throw new Error(`File ${scenePathStr} is not a scene file`);
    }

    const node = getNodeByPath(parsed, nodePathStr);
    if (!node) {
      throw new Error(`Node ${nodePathStr} not found in scene ${scenePathStr}`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(node, null, 2)
      }]
    };
  }
);

// Resource introspection resources
server.registerResource("resources_list", "godot://project/resources/",
  {
    title: "Project Resources",
    description: "List all .tres resource files in the Godot project",
    mimeType: "application/json"
  },
  async (uri) => {
    const resources = findGodotFiles(projectPath, '.tres');

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(resources, null, 2)
      }]
    };
  }
);

server.registerResource("resource_data", new ResourceTemplate("godot://project/resources/{resourcePath...}", {
  list: async () => {
    const resources = findGodotFiles(projectPath, '.tres');
    const resourceList = resources.map(resourcePath => ({
      uri: `godot://project/resources/${resourcePath}`,
      name: `resource-${resourcePath}`,
      mimeType: "application/json"
    }));
    return { resources: resourceList };
  }
}),
  {
    title: "Resource Data",
    description: "Get full parsed resource data",
    mimeType: "application/json"
  },
  async (uri, { resourcePath }) => {
    const resourcePathStr = (resourcePath as string[]).join('/');
    const parsed = parseGodotFile(resourcePathStr);

    if (!isGodotResource(parsed)) {
      throw new Error(`File ${resourcePathStr} is not a resource file`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(parsed, null, 2)
      }]
    };
  }
);

// Resource type query resources
server.registerResource("resource_types_list", "godot://project/resourceTypes/",
  {
    title: "Resource Types",
    description: "List all resource types found in the project",
    mimeType: "application/json"
  },
  async (uri) => {
    const resources = findGodotFiles(projectPath, '.tres');
    const typeSet = new Set<string>();

    for (const resourcePath of resources) {
      try {
        const parsed = parseGodotFile(resourcePath);
        if (isGodotResource(parsed)) {
          typeSet.add(parsed.header.resourceType);
        }
      } catch (_error) {
        // Skip files we can't parse
      }
    }

    const types = Array.from(typeSet).sort();

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(types, null, 2)
      }]
    };
  }
);

server.registerResource("resources_by_type", new ResourceTemplate("godot://project/resourceTypes/{type}", {
  list: async () => {
    const resources = findGodotFiles(projectPath, '.tres');
    const typeSet = new Set<string>();

    for (const resourcePath of resources) {
      try {
        const parsed = parseGodotFile(resourcePath);
        if (isGodotResource(parsed)) {
          typeSet.add(parsed.header.resourceType);
        }
      } catch (_error) {
        // Skip files we can't parse
      }
    }

    const resourceList = Array.from(typeSet).map(type => ({
      uri: `godot://project/resourceTypes/${type}`,
      name: `type-${type}`,
      mimeType: "application/json"
    }));

    return { resources: resourceList };
  }
}),
  {
    title: "Resources by Type",
    description: "List all resources of a specific type with their paths",
    mimeType: "application/json"
  },
  async (uri, { type }) => {
    const typeStr = type as string;
    const resources = findGodotFiles(projectPath, '.tres');
    const matchingResources: string[] = [];

    for (const resourcePath of resources) {
      try {
        const parsed = parseGodotFile(resourcePath);
        if (isGodotResource(parsed) && parsed.header.resourceType === typeStr) {
          matchingResources.push(resourcePath);
        }
      } catch (_error) {
        // Skip files we can't parse
      }
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(matchingResources, null, 2)
      }]
    };
  }
);

server.registerResource("resources_property_by_type", new ResourceTemplate("godot://project/resourceTypes/{type}/{property}", {
  list: undefined
}),
  {
    title: "Resource Property by Type",
    description: "Get a specific property value from all resources of a given type",
    mimeType: "application/json"
  },
  async (uri, { type, property }) => {
    const typeStr = type as string;
    const propertyStr = property as string;
    const resources = findGodotFiles(projectPath, '.tres');
    const results: Array<{ path: string; value: unknown }> = [];

    for (const resourcePath of resources) {
      try {
        const parsed = parseGodotFile(resourcePath);
        if (isGodotResource(parsed) && parsed.header.resourceType === typeStr) {
          // Check if property exists in resource section
          if (parsed.resource?.properties[propertyStr] !== undefined) {
            results.push({
              path: resourcePath,
              value: parsed.resource.properties[propertyStr]
            });
          }
        }
      } catch (_error) {
        // Skip files we can't parse
      }
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(results, null, 2)
      }]
    };
  }
);

// Resources for project management
server.registerResource("runs_list", "godot://runs/",
  {
    title: "Running Projects",
    description: "List all currently running Godot projects",
    mimeType: "application/json"
  },
  async (uri) => {
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
  }
);

server.registerResource("project_stdout", new ResourceTemplate("godot://runs/{runId}/stdout", {
  list: async () => {
    const resources = Array.from(runningProjects.keys()).map(runId => ({
      uri: `godot://runs/${runId}/stdout`,
      name: `stdout-${runId}`,
      mimeType: "text/plain"
    }));
    return { resources };
  }
}),
  {
    title: "Project Standard Output",
    description: "Get the standard output for a specific project run",
    mimeType: "text/plain"
  },
  async (uri, { runId }) => {
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
  }
);

server.registerResource("project_stderr", new ResourceTemplate("godot://runs/{runId}/stderr", {
  list: async () => {
    const resources = Array.from(runningProjects.keys()).map(runId => ({
      uri: `godot://runs/${runId}/stderr`,
      name: `stderr-${runId}`,
      mimeType: "text/plain"
    }));
    return { resources };
  }
}),
  {
    title: "Project Standard Error",
    description: "Get the standard error for a specific project run",
    mimeType: "text/plain"
  },
  async (uri, { runId }) => {
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
  }
);

server.registerResource("project_status", new ResourceTemplate("godot://runs/{runId}/status", {
  list: async () => {
    const resources = Array.from(runningProjects.keys()).map(runId => ({
      uri: `godot://runs/${runId}/status`,
      name: `status-${runId}`,
      mimeType: "application/json"
    }));
    return { resources };
  }
}),
  {
    title: "Project Status",
    description: "Get the status information for a specific project run",
    mimeType: "application/json"
  },
  async (uri, { runId }) => {
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
  }
);


// Clean up on process exit
process.on("exit", () => {
  for (const projectRun of runningProjects.values()) {
    if (projectRun.status === 'running') {
      projectRun.process.kill();
    }
  }
});

process.on("SIGINT", () => {
  for (const projectRun of runningProjects.values()) {
    if (projectRun.status === 'running') {
      projectRun.process.kill();
    }
  }
  process.exit(0);
});

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
