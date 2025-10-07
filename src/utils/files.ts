import { parse, type GodotResource, type GodotScene } from "@fernforestgames/godot-resource-parser";
import * as fs from "fs";
import * as path from "path";

// Helper functions for file discovery
export function findGodotFiles(directory: string | undefined, extension: string): string[] {
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
    } catch (error) {
      // Skip directories we can't read
      console.error(`Warning: Failed to read directory ${dir}:`, error);
    }
  }

  searchDir(rootDir);
  return results;
}

export function parseGodotFile(projectPath: string | undefined, filePath: string): GodotScene | GodotResource {
  if (!projectPath) {
    throw new Error("Project path is not defined");
  }
  const fullPath = path.join(projectPath, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return parse(content);
}
