// Search implementation for Godot documentation
import type { SearchMatch, GodotClass } from './types.js';
import { docsIndex } from './index.js';

/**
 * Search the documentation index
 *
 * Searches across:
 * - Class names
 * - Method names
 * - Property names
 * - Signal names
 * - Constant names
 * - Descriptions (lower priority)
 */
export async function searchDocs(query: string, limit: number = 10): Promise<SearchMatch[]> {
  await docsIndex.ensureInitialized();

  const queryLower = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (const godotClass of docsIndex.getAllClasses()) {
    // Search class name
    const classScore = scoreMatch(godotClass.name, queryLower);
    if (classScore > 0) {
      results.push({
        className: godotClass.name,
        matchType: 'class',
        name: godotClass.name,
        excerpt: godotClass.brief || godotClass.description.slice(0, 200),
        score: classScore * 10, // Boost class matches
      });
    }

    // Search methods
    for (const method of godotClass.methods) {
      const methodScore = scoreMatch(method.name, queryLower);
      if (methodScore > 0) {
        results.push({
          className: godotClass.name,
          matchType: 'method',
          name: method.name,
          excerpt: formatMethodSignature(method) + (method.description ? '\n' + method.description.slice(0, 150) : ''),
          score: methodScore * 5,
        });
      }
    }

    // Search properties
    for (const prop of godotClass.properties) {
      const propScore = scoreMatch(prop.name, queryLower);
      if (propScore > 0) {
        results.push({
          className: godotClass.name,
          matchType: 'property',
          name: prop.name,
          excerpt: `${prop.type} ${prop.name}` + (prop.description ? '\n' + prop.description.slice(0, 150) : ''),
          score: propScore * 5,
        });
      }
    }

    // Search signals
    for (const signal of godotClass.signals) {
      const signalScore = scoreMatch(signal.name, queryLower);
      if (signalScore > 0) {
        results.push({
          className: godotClass.name,
          matchType: 'signal',
          name: signal.name,
          excerpt: formatSignalSignature(signal) + (signal.description ? '\n' + signal.description.slice(0, 150) : ''),
          score: signalScore * 5,
        });
      }
    }

    // Search constants
    for (const constant of godotClass.constants) {
      const constScore = scoreMatch(constant.name, queryLower);
      if (constScore > 0) {
        results.push({
          className: godotClass.name,
          matchType: 'constant',
          name: constant.name,
          excerpt: `${constant.name} = ${constant.value}` + (constant.enum ? ` (${constant.enum})` : '') + (constant.description ? '\n' + constant.description.slice(0, 150) : ''),
          score: constScore * 3,
        });
      }
    }

    // Also search descriptions (lower priority)
    const descScore = scoreDescriptionMatch(godotClass, queryLower);
    if (descScore > 0 && classScore === 0) {
      // Only add if not already matched by name
      results.push({
        className: godotClass.name,
        matchType: 'class',
        name: godotClass.name,
        excerpt: extractRelevantExcerpt(godotClass.description, query),
        score: descScore,
      });
    }
  }

  // Sort by score (highest first) and limit
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Score a match between a name and query
 * Returns 0 for no match, higher for better matches
 */
function scoreMatch(name: string, queryLower: string): number {
  const nameLower = name.toLowerCase();

  // Exact match
  if (nameLower === queryLower) {
    return 100;
  }

  // Starts with query
  if (nameLower.startsWith(queryLower)) {
    return 80;
  }

  // Contains query
  if (nameLower.includes(queryLower)) {
    return 60;
  }

  // Query contains name (e.g., searching "RigidBody3D move" matches "move")
  if (queryLower.includes(nameLower) && nameLower.length > 3) {
    return 40;
  }

  // Word boundary match (e.g., "move" matches "move_and_slide")
  const words = nameLower.split(/[_\s]+/);
  for (const word of words) {
    if (word === queryLower) {
      return 70;
    }
    if (word.startsWith(queryLower)) {
      return 50;
    }
  }

  return 0;
}

/**
 * Score description matches
 */
function scoreDescriptionMatch(godotClass: GodotClass, queryLower: string): number {
  const desc = (godotClass.brief + ' ' + godotClass.description).toLowerCase();

  // Check if query appears in description
  if (desc.includes(queryLower)) {
    // Bonus for multiple occurrences
    const count = (desc.match(new RegExp(escapeRegExp(queryLower), 'g')) || []).length;
    return Math.min(20 + count * 5, 40);
  }

  return 0;
}

/**
 * Extract a relevant excerpt from description containing the query
 */
function extractRelevantExcerpt(description: string, query: string): string {
  const queryLower = query.toLowerCase();
  const descLower = description.toLowerCase();
  const index = descLower.indexOf(queryLower);

  if (index === -1) {
    return description.slice(0, 200);
  }

  // Get context around the match
  const start = Math.max(0, index - 50);
  const end = Math.min(description.length, index + query.length + 150);

  let excerpt = description.slice(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < description.length) excerpt = excerpt + '...';

  return excerpt;
}

/**
 * Format method signature for display
 */
function formatMethodSignature(method: { name: string; returnType: string; params: { name: string; type: string; default?: string }[]; qualifiers?: string }): string {
  const params = method.params.map(p => {
    let param = `${p.name}: ${p.type}`;
    if (p.default !== undefined) {
      param += ` = ${p.default}`;
    }
    return param;
  }).join(', ');

  let sig = `${method.returnType} ${method.name}(${params})`;
  if (method.qualifiers) {
    sig += ` [${method.qualifiers}]`;
  }
  return sig;
}

/**
 * Format signal signature for display
 */
function formatSignalSignature(signal: { name: string; params: { name: string; type: string }[] }): string {
  const params = signal.params.map(p => `${p.name}: ${p.type}`).join(', ');
  return `signal ${signal.name}(${params})`;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
