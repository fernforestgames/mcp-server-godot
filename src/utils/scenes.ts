import { type GodotScene, type Node as GodotNode } from "@fernforestgames/godot-resource-parser";

export function getNodeByPath(scene: GodotScene, nodePath: string): GodotNode | undefined {
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

export function getFullNodePath(scene: GodotScene, node: GodotNode): string {
  if (!node.parent || node.parent === ".") {
    return node.name;
  }

  const parentNode = scene.nodes.find((n: GodotNode) => n.name === node.parent);
  if (!parentNode) {
    return node.name;
  }

  return `${getFullNodePath(scene, parentNode)}/${node.name}`;
}
