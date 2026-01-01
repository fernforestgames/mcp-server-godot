// MCP tool handler for searching Godot documentation
import { searchDocs } from '../../docs/search.js';

/**
 * Strip BBCode and clean up excerpt text
 */
function cleanExcerpt(text: string): string {
  return text
    .replace(/\[code\](.*?)\[\/code\]/g, '`$1`')
    .replace(/\[codeblock\][\s\S]*?\[\/codeblock\]/g, '')
    .replace(/\[param\s+(\w+)\]/g, '`$1`')
    .replace(/\[method\s+(\w+)\]/g, '`$1()`')
    .replace(/\[member\s+(\w+)\]/g, '`$1`')
    .replace(/\[signal\s+(\w+)\]/g, '`$1`')
    .replace(/\[constant\s+([^\]]+)\]/g, '`$1`')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\t+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export async function searchGodotDocs({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) {
  try {
    const results = await searchDocs(query, limit);

    if (results.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No results found for "${query}".`
        }]
      };
    }

    // Format as compact text
    const lines: string[] = [`Found ${results.length} result(s) for "${query}":\n`];

    for (const r of results) {
      const prefix = r.matchType === 'class' ? '' : `${r.className}.`;
      const typeLabel = r.matchType.charAt(0).toUpperCase() + r.matchType.slice(1);
      const excerpt = cleanExcerpt(r.excerpt);

      lines.push(`[${typeLabel}] ${prefix}${r.name}`);
      if (excerpt) {
        lines.push(`  ${excerpt}`);
      }
      lines.push('');
    }

    return {
      content: [{
        type: "text" as const,
        text: lines.join('\n').trim()
      }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: "text" as const,
        text: `Failed to search documentation: ${message}`
      }]
    };
  }
}
