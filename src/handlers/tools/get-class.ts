// MCP tool handler for getting full Godot class documentation
import { docsIndex } from '../../docs/index.js';

export async function getGodotClass({
  className,
}: {
  className: string;
}) {
  try {
    await docsIndex.ensureInitialized();

    const godotClass = docsIndex.getClass(className);

    if (!godotClass) {
      // Try case-insensitive search
      const allClasses = docsIndex.getAllClassNames();
      const match = allClasses.find(c => c.toLowerCase() === className.toLowerCase());

      if (match) {
        const matchedClass = docsIndex.getClass(match);
        if (matchedClass) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(matchedClass, null, 2)
            }]
          };
        }
      }

      // Suggest similar classes
      const similar = allClasses
        .filter(c => c.toLowerCase().includes(className.toLowerCase()) ||
                     className.toLowerCase().includes(c.toLowerCase().slice(0, 4)))
        .slice(0, 5);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `Class '${className}' not found`,
            suggestions: similar.length > 0 ? similar : undefined,
            hint: 'Use search_godot_docs to find the correct class name',
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(godotClass, null, 2)
      }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          error: `Failed to get class documentation: ${message}`,
          className,
        }, null, 2)
      }]
    };
  }
}
