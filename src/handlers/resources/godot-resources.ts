import { isGodotResource } from "@fernforestgames/godot-resource-parser";
import { projectPath } from "../../config.js";
import { findGodotFiles, parseGodotFile } from "../../utils/files.js";

// Resource introspection resources
export const resourcesList = async (uri: URL) => {
  const resources = findGodotFiles(projectPath, '.tres');

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(resources, null, 2)
    }]
  };
};

// List callback for resource data template
export const resourceDataList = async () => {
  const resources = findGodotFiles(projectPath, '.tres');
  const resourceList = resources.map(resourcePath => ({
    uri: `godot://project/resources/${resourcePath}`,
    name: `resource-${resourcePath}`,
    mimeType: "application/json"
  }));
  return { resources: resourceList };
};

export const resourceData = async (uri: URL, params: any) => {
  const resourcePath = params['resourcePath...'];
  if (!resourcePath) {
    throw new Error(`resourcePath parameter is required, got: ${JSON.stringify(params)}`);
  }
  const resourcePathStr = resourcePath;
  const parsed = parseGodotFile(projectPath, resourcePathStr);

  if (!isGodotResource(parsed)) {
    throw new Error(`File ${resourcePathStr} is not a resource file`);
  }

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(parsed, null, 2)
    }]
  };
};

// Resource type query resources
export const resourceTypesList = async (uri: URL) => {
  const resources = findGodotFiles(projectPath, '.tres');
  const typeSet = new Set<string>();

  for (const resourcePath of resources) {
    try {
      const parsed = parseGodotFile(projectPath, resourcePath);
      if (isGodotResource(parsed)) {
        // Prefer scriptClass if available, otherwise use resourceType
        const type = (parsed.header as any).scriptClass || parsed.header.resourceType;
        typeSet.add(type);
      }
    } catch (error) {
      // Skip files we can't parse
      console.error(`Warning: Failed to parse resource ${resourcePath}:`, error);
    }
  }

  const types = Array.from(typeSet).sort();

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(types, null, 2)
    }]
  };
};

// List callback for resources by type template
export const resourcesByTypeList = async () => {
  const resources = findGodotFiles(projectPath, '.tres');
  const typeSet = new Set<string>();

  for (const resourcePath of resources) {
    try {
      const parsed = parseGodotFile(projectPath, resourcePath);
      if (isGodotResource(parsed)) {
        // Prefer scriptClass if available, otherwise use resourceType
        const type = (parsed.header as any).scriptClass || parsed.header.resourceType;
        typeSet.add(type);
      }
    } catch (error) {
      // Skip files we can't parse
      console.error(`Warning: Failed to parse resource ${resourcePath}:`, error);
    }
  }

  const resourceList = Array.from(typeSet).map(type => ({
    uri: `godot://project/resourceTypes/${type}`,
    name: `type-${type}`,
    mimeType: "application/json"
  }));

  return { resources: resourceList };
};

export const resourcesByType = async (uri: URL, { type }: any) => {
  const typeStr = type as string;
  const resources = findGodotFiles(projectPath, '.tres');
  const matchingResources: string[] = [];

  for (const resourcePath of resources) {
    try {
      const parsed = parseGodotFile(projectPath, resourcePath);
      if (isGodotResource(parsed)) {
        // Match against scriptClass if available, otherwise use resourceType
        const resourceType = (parsed.header as any).scriptClass || parsed.header.resourceType;
        if (resourceType === typeStr) {
          matchingResources.push(resourcePath);
        }
      }
    } catch (error) {
      // Skip files we can't parse
      console.error(`Warning: Failed to parse resource ${resourcePath}:`, error);
    }
  }

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(matchingResources, null, 2)
    }]
  };
};

export const resourcePropertyByType = async (uri: URL, { type, property }: any) => {
  const typeStr = type as string;
  const propertyStr = property as string;
  const resources = findGodotFiles(projectPath, '.tres');
  const results: Array<{ path: string; value: unknown }> = [];

  for (const resourcePath of resources) {
    try {
      const parsed = parseGodotFile(projectPath, resourcePath);
      if (isGodotResource(parsed)) {
        // Match against scriptClass if available, otherwise use resourceType
        const resourceType = (parsed.header as any).scriptClass || parsed.header.resourceType;
        if (resourceType === typeStr) {
          // Check if property exists in resource section
          if (parsed.resource?.properties[propertyStr] !== undefined) {
            results.push({
              path: resourcePath,
              value: parsed.resource.properties[propertyStr]
            });
          }
        }
      }
    } catch (error) {
      // Skip files we can't parse
      console.error(`Warning: Failed to parse resource ${resourcePath}:`, error);
    }
  }

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(results, null, 2)
    }]
  };
};

export const resourceProperty = async (uri: URL, params: any) => {
  const resourcePath = params['resourcePath...'];
  const property = params.property;

  if (!resourcePath) {
    throw new Error(`resourcePath parameter is required, got: ${JSON.stringify(params)}`);
  }
  if (!property) {
    throw new Error(`property parameter is required, got: ${JSON.stringify(params)}`);
  }

  const resourcePathStr = resourcePath;
  const propertyStr = property as string;
  const parsed = parseGodotFile(projectPath, resourcePathStr);

  if (!isGodotResource(parsed)) {
    throw new Error(`File ${resourcePathStr} is not a resource file`);
  }

  // Check if property exists in resource section
  if (parsed.resource?.properties[propertyStr] === undefined) {
    throw new Error(`Property ${propertyStr} not found in resource ${resourcePathStr}`);
  }

  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify(parsed.resource.properties[propertyStr], null, 2)
    }]
  };
};
