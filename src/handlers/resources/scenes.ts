import { isGodotScene, type Node as GodotNode } from "@fernforestgames/godot-resource-parser";
import { projectPath } from "../../config.js";
import { findGodotFiles, parseGodotFile } from "../../utils/files.js";
import { getFullNodePath, getNodeByPath } from "../../utils/scenes.js";

// Scene structure resources
export const scenesList = async (uri: URL) => {
  const scenes = findGodotFiles(projectPath, '.tscn');

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(scenes, null, 2)
    }]
  };
};

// List callback for scene data template
export const sceneDataList = async () => {
  const scenes = findGodotFiles(projectPath, '.tscn');
  const resources = scenes.map(scenePath => ({
    uri: `godot://project/scenes/${scenePath}`,
    name: `scene-${scenePath}`,
    mimeType: "application/json"
  }));
  return { resources };
};

export const sceneData = async (uri: URL, params: any) => {
  const scenePath = params['scenePath...'];
  if (!scenePath) {
    throw new Error(`scenePath parameter is required, got: ${JSON.stringify(params)}`);
  }
  const scenePathStr = scenePath;
  const parsed = parseGodotFile(projectPath, scenePathStr);

  if (!isGodotScene(parsed)) {
    throw new Error(`File ${scenePathStr} is not a scene file`);
  }

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(parsed, null, 2)
    }]
  };
};

// List callback for scene nodes template
export const sceneNodesList = async () => {
  const scenes = findGodotFiles(projectPath, '.tscn');
  const resources = scenes.map(scenePath => ({
    uri: `godot://project/scenes/${scenePath}/nodes`,
    name: `nodes-${scenePath}`,
    mimeType: "application/json"
  }));
  return { resources };
};

export const sceneNodes = async (uri: URL, params: any) => {
  const scenePath = params['scenePath...'];
  if (!scenePath) {
    throw new Error(`scenePath parameter is required, got: ${JSON.stringify(params)}`);
  }
  const scenePathStr = scenePath;
  const parsed = parseGodotFile(projectPath, scenePathStr);

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
};

export const sceneNodeDetail = async (uri: URL, params: any) => {
  const scenePath = params['scenePath...'];
  const nodePath = params['nodePath...'];
  if (!scenePath || !nodePath) {
    throw new Error(`scenePath and nodePath parameters are required, got: ${JSON.stringify(params)}`);
  }
  const scenePathStr = scenePath;
  const nodePathStr = nodePath;
  const parsed = parseGodotFile(projectPath, scenePathStr);

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
};
