// MCP tool handler for searching Godot documentation
import { searchDocs } from '../../docs/search.js';

export async function searchGodotDocs({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) {
  try {
    const results = await searchDocs(query, limit);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          query,
          results: results.map(r => ({
            class: r.className,
            type: r.matchType,
            name: r.name,
            excerpt: r.excerpt,
          })),
          count: results.length,
        }, null, 2)
      }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          error: `Failed to search documentation: ${message}`,
          query,
        }, null, 2)
      }]
    };
  }
}
