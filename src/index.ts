#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import "./config.js"; // Validate configuration on startup
import { runProject } from "./handlers/tools/run-project.js";
import { stopProject } from "./handlers/tools/stop-project.js";
import { searchScenes } from "./handlers/tools/search-scenes.js";
import { captureScreenshot } from "./handlers/tools/screenshot.js";
import * as sceneResources from "./handlers/resources/scenes.js";
import * as godotResources from "./handlers/resources/godot-resources.js";
import * as runResources from "./handlers/resources/runs.js";
import { type ProjectRun } from "./types.js";

const server = new McpServer({
  name: "mcp-server-godot",
  version: "0.1.0",
});

// Storage for running projects (tied to MCP server lifetime)
const runningProjects = new Map<string, ProjectRun>();

// Register tools
server.registerTool("run_project",
  {
    title: "Run Godot Project",
    description: "Start a Godot project and return a run ID for managing it",
    inputSchema: {
      projectPath: z.string().optional().describe("Path to the Godot project (defaults to command line argument)"),
      args: z.array(z.string()).optional().describe("Optional arguments to pass to Godot on startup")
    }
  },
  async (params) => runProject(runningProjects, params)
);

server.registerTool("stop_project",
  {
    title: "Stop Godot Project",
    description: "Stop a running Godot project by its run ID",
    inputSchema: {
      runId: z.string().describe("The run ID of the project to stop")
    }
  },
  async (params) => stopProject(runningProjects, params)
);

server.registerTool("search_scenes",
  {
    title: "Search Scenes",
    description: "Find nodes or scenes matching criteria (by node type, name pattern, or property)",
    inputSchema: {
      nodeType: z.string().optional().describe("Filter by node type (e.g., 'CharacterBody2D')"),
      namePattern: z.string().optional().describe("Filter by name pattern (case-insensitive substring match)"),
      propertyName: z.string().optional().describe("Filter by nodes that have a specific property"),
      propertyValue: z.string().optional().describe("Filter by nodes where property has a specific value (requires propertyName)"),
      limit: z.number().default(100).describe("Maximum number of results to return"),
      offset: z.number().default(0).describe("Number of results to skip for pagination")
    }
  },
  searchScenes
);

server.registerTool("capture_screenshot",
  {
    title: "Capture Screenshot",
    description: "Capture a screenshot of the Godot game window or all monitors",
    inputSchema: {
      target: z.enum(["godot", "all_monitors", "primary_monitor"]).default("godot").describe("Screenshot target: 'godot' for Godot window, 'all_monitors' for all monitors, 'primary_monitor' for primary monitor"),
      format: z.enum(["png", "jpeg", "bmp"]).default("png").describe("Image format"),
      outputPath: z.string().optional().describe("Optional output file path. If not provided, returns base64 encoded image data")
    }
  },
  captureScreenshot
);

// Register scene resources
server.registerResource("scenes_list", "godot://project/scenes/",
  {
    title: "Project Scenes",
    description: "List all .tscn scene files in the Godot project",
    mimeType: "application/json"
  },
  sceneResources.scenesList
);

server.registerResource("scene_data", new ResourceTemplate("godot://project/scenes/{scenePath...}", {
  list: sceneResources.sceneDataList
}),
  {
    title: "Scene Data",
    description: "Get full parsed scene data including nodes, connections, and resources",
    mimeType: "application/json"
  },
  sceneResources.sceneData
);

server.registerResource("scene_nodes", new ResourceTemplate("godot://project/scenes/{scenePath...}/nodes", {
  list: sceneResources.sceneNodesList
}),
  {
    title: "Scene Node Hierarchy",
    description: "Get the node hierarchy with names, types, and parent relationships",
    mimeType: "application/json"
  },
  sceneResources.sceneNodes
);

server.registerResource("scene_node_detail", new ResourceTemplate("godot://project/scenes/{scenePath...}/nodes/{nodePath...}", {
  list: undefined
}),
  {
    title: "Scene Node Details",
    description: "Get detailed information about a specific node including all properties",
    mimeType: "application/json"
  },
  sceneResources.sceneNodeDetail
);

// Register Godot resource files
server.registerResource("resources_list", "godot://project/resources/",
  {
    title: "Project Resources",
    description: "List all .tres resource files in the Godot project",
    mimeType: "application/json"
  },
  godotResources.resourcesList
);

server.registerResource("resource_data", new ResourceTemplate("godot://project/resources/{resourcePath...}", {
  list: godotResources.resourceDataList
}),
  {
    title: "Resource Data",
    description: "Get full parsed resource data",
    mimeType: "application/json"
  },
  godotResources.resourceData
);

server.registerResource("resource_property", new ResourceTemplate("godot://project/resources/{resourcePath...}/properties/{property}", {
  list: undefined
}),
  {
    title: "Resource Property",
    description: "Get a specific property value from a resource file",
    mimeType: "application/json"
  },
  godotResources.resourceProperty
);

server.registerResource("resource_types_list", "godot://project/resourceTypes/",
  {
    title: "Resource Types",
    description: "List all resource types found in the project",
    mimeType: "application/json"
  },
  godotResources.resourceTypesList
);

server.registerResource("resources_by_type", new ResourceTemplate("godot://project/resourceTypes/{type}", {
  list: godotResources.resourcesByTypeList
}),
  {
    title: "Resources by Type",
    description: "List all resources of a specific type with their paths",
    mimeType: "application/json"
  },
  godotResources.resourcesByType
);

server.registerResource("resources_property_by_type", new ResourceTemplate("godot://project/resourceTypes/{type}/properties/{property}", {
  list: undefined
}),
  {
    title: "Resource Property by Type",
    description: "Get a specific property value from all resources of a given type",
    mimeType: "application/json"
  },
  godotResources.resourcePropertyByType
);

// Register run management resources
server.registerResource("runs_list", "godot://runs/",
  {
    title: "Running Projects",
    description: "List all currently running Godot projects",
    mimeType: "application/json"
  },
  async (uri) => runResources.runsList(uri, runningProjects)
);

server.registerResource("project_stdout", new ResourceTemplate("godot://runs/{runId}/stdout", {
  list: runResources.projectStdoutList(runningProjects)
}),
  {
    title: "Project Standard Output",
    description: "Get the standard output for a specific project run",
    mimeType: "text/plain"
  },
  async (uri, params) => runResources.projectStdout(uri, params, runningProjects)
);

server.registerResource("project_stderr", new ResourceTemplate("godot://runs/{runId}/stderr", {
  list: runResources.projectStderrList(runningProjects)
}),
  {
    title: "Project Standard Error",
    description: "Get the standard error for a specific project run",
    mimeType: "text/plain"
  },
  async (uri, params) => runResources.projectStderr(uri, params, runningProjects)
);

server.registerResource("project_status", new ResourceTemplate("godot://runs/{runId}/status", {
  list: runResources.projectStatusList(runningProjects)
}),
  {
    title: "Project Status",
    description: "Get the status information for a specific project run",
    mimeType: "application/json"
  },
  async (uri, params) => runResources.projectStatus(uri, params, runningProjects)
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
