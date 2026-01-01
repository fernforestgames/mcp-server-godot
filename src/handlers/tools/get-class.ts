// MCP tool handler for getting full Godot class documentation
import { docsIndex } from '../../docs/index.js';
import { formatClassAsText } from '../../docs/format.js';

export async function getGodotClass({
  className,
}: {
  className: string;
}) {
  try {
    await docsIndex.ensureInitialized();

    let godotClass = docsIndex.getClass(className);

    // Try case-insensitive search if not found
    if (!godotClass) {
      const allClasses = docsIndex.getAllClassNames();
      const match = allClasses.find(c => c.toLowerCase() === className.toLowerCase());

      if (match) {
        godotClass = docsIndex.getClass(match);
      }
    }

    if (!godotClass) {
      // Suggest similar classes
      const allClasses = docsIndex.getAllClassNames();
      const similar = allClasses
        .filter(c => c.toLowerCase().includes(className.toLowerCase()) ||
                     className.toLowerCase().includes(c.toLowerCase().slice(0, 4)))
        .slice(0, 5);

      let errorMsg = `Class '${className}' not found.`;
      if (similar.length > 0) {
        errorMsg += ` Did you mean: ${similar.join(', ')}?`;
      }
      errorMsg += ' Use search_godot_docs to find the correct class name.';

      return {
        content: [{
          type: "text" as const,
          text: errorMsg
        }]
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: formatClassAsText(godotClass)
      }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: "text" as const,
        text: `Failed to get class documentation: ${message}`
      }]
    };
  }
}
