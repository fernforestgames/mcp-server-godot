import { isGodotScene } from "@fernforestgames/godot-resource-parser";
import { projectPath } from "../../config.js";
import { findGodotFiles, parseGodotFile } from "../../utils/files.js";
import { getFullNodePath } from "../../utils/scenes.js";

export async function searchScenes({
  nodeType,
  namePattern,
  propertyName,
  propertyValue,
  limit = 100,
  offset = 0
}: {
  nodeType?: string | undefined;
  namePattern?: string | undefined;
  propertyName?: string | undefined;
  propertyValue?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}) {
  const scenes = findGodotFiles(projectPath, '.tscn');
  const results: Array<{ scene: string; node: string; type: string; properties?: Record<string, unknown> }> = [];

  for (const scenePath of scenes) {
    try {
      const parsed = parseGodotFile(projectPath, scenePath);
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
    } catch (error) {
      // Skip scenes we can't parse
      console.error(`Warning: Failed to parse scene ${scenePath}:`, error);
    }
  }

  const totalResults = results.length;
  const paginatedResults = results.slice(offset, offset + limit);
  const hasMore = (offset + limit) < totalResults;

  return {
    content: [{
      type: "text" as const,
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
