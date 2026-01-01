#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import "./config.js"; // Validate configuration on startup
import { runProject } from "./handlers/tools/run-project.js";
import { stopProject } from "./handlers/tools/stop-project.js";
import { searchScenes } from "./handlers/tools/search-scenes.js";
import { captureScreenshot } from "./handlers/tools/screenshot.js";
import { getSceneTree } from "./handlers/tools/get-scene-tree.js";
import { getNode } from "./handlers/tools/get-node.js";
import { setProperty } from "./handlers/tools/set-property.js";
import { callMethod } from "./handlers/tools/call-method.js";
import { changeScene } from "./handlers/tools/change-scene.js";
import { sendInputAction, sendInputKey, sendInputMouseButton, sendInputMouseMotion } from "./handlers/tools/send-input.js";
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
    description: "Capture a screenshot of the Godot game viewport. Requires the MCP Bridge addon to be installed in the project.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project to capture"),
      format: z.enum(["png", "jpeg"]).default("png").describe("Image format"),
      outputPath: z.string().optional().describe("Optional output file path. If not provided, returns base64 encoded image data")
    }
  },
  async (params) => captureScreenshot(runningProjects, params)
);

// Bridge-dependent tools (require MCP Bridge addon)
server.registerTool("get_scene_tree",
  {
    title: "Get Scene Tree",
    description: "Get the live scene tree hierarchy from a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project")
    }
  },
  async (params) => getSceneTree(runningProjects, params)
);

server.registerTool("get_node",
  {
    title: "Get Node",
    description: "Get information about a specific node in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      nodePath: z.string().describe("Path to the node (e.g., '/root/Main/Player' or 'Player/Sprite2D')")
    }
  },
  async (params) => getNode(runningProjects, params)
);

server.registerTool("set_property",
  {
    title: "Set Property",
    description: "Set a property on a node in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      nodePath: z.string().describe("Path to the node"),
      property: z.string().describe("Name of the property to set"),
      value: z.any().describe("Value to set the property to")
    }
  },
  async (params) => setProperty(runningProjects, params)
);

server.registerTool("call_method",
  {
    title: "Call Method",
    description: "Call a method on a node in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      nodePath: z.string().describe("Path to the node"),
      method: z.string().describe("Name of the method to call"),
      args: z.array(z.any()).optional().describe("Arguments to pass to the method")
    }
  },
  async (params) => callMethod(runningProjects, params)
);

server.registerTool("change_scene",
  {
    title: "Change Scene",
    description: "Change the current scene in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      scenePath: z.string().describe("Path to the scene file (e.g., 'res://scenes/main.tscn')")
    }
  },
  async (params) => changeScene(runningProjects, params)
);

server.registerTool("send_input_action",
  {
    title: "Send Input Action",
    description: "Trigger an input action in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      action: z.string().describe("Name of the input action (must be defined in project input map)"),
      pressed: z.boolean().default(true).describe("Whether the action is pressed or released"),
      strength: z.number().default(1.0).describe("Strength of the action (0.0 to 1.0)")
    }
  },
  async (params) => sendInputAction(runningProjects, params)
);

server.registerTool("send_input_key",
  {
    title: "Send Key Input",
    description: "Simulate a key press/release in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      keycode: z.number().describe("Godot keycode (e.g., KEY_SPACE = 32, KEY_A = 65)"),
      pressed: z.boolean().default(true).describe("Whether the key is pressed or released"),
      shift: z.boolean().default(false).describe("Whether Shift is held"),
      ctrl: z.boolean().default(false).describe("Whether Ctrl is held"),
      alt: z.boolean().default(false).describe("Whether Alt is held"),
      meta: z.boolean().default(false).describe("Whether Meta/Cmd is held")
    }
  },
  async (params) => sendInputKey(runningProjects, params)
);

server.registerTool("send_input_mouse_button",
  {
    title: "Send Mouse Button Input",
    description: "Simulate a mouse button press/release in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      button: z.number().describe("Mouse button (1 = left, 2 = right, 3 = middle)"),
      pressed: z.boolean().default(true).describe("Whether the button is pressed or released"),
      x: z.number().describe("X coordinate of the mouse position"),
      y: z.number().describe("Y coordinate of the mouse position")
    }
  },
  async (params) => sendInputMouseButton(runningProjects, params)
);

server.registerTool("send_input_mouse_motion",
  {
    title: "Send Mouse Motion Input",
    description: "Simulate mouse movement in a running Godot project. Requires the MCP Bridge addon.",
    inputSchema: {
      runId: z.string().describe("The run ID of the project"),
      relativeX: z.number().describe("Relative X movement"),
      relativeY: z.number().describe("Relative Y movement"),
      x: z.number().optional().describe("Optional absolute X position"),
      y: z.number().optional().describe("Optional absolute Y position")
    }
  },
  async (params) => sendInputMouseMotion(runningProjects, params)
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
