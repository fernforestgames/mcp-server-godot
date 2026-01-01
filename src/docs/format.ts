// Format Godot documentation for LLM consumption
import type { GodotClass, GodotMethod, GodotProperty, GodotSignal, GodotConstant } from './types.js';

/**
 * Strip BBCode-style tags from Godot documentation text
 */
function stripBBCode(text: string): string {
  return text
    // Convert [code]x[/code] to `x`
    .replace(/\[code\](.*?)\[\/code\]/g, '`$1`')
    // Convert [codeblock]...[/codeblock] to indented block
    .replace(/\[codeblock\]([\s\S]*?)\[\/codeblock\]/g, (_, code) => {
      const lines = code.trim().split('\n');
      return '\n' + lines.map((l: string) => '    ' + l).join('\n') + '\n';
    })
    // Convert [b]x[/b] to *x*
    .replace(/\[b\](.*?)\[\/b\]/g, '*$1*')
    // Convert [i]x[/i] to _x_
    .replace(/\[i\](.*?)\[\/i\]/g, '_$1_')
    // Convert [param x] to `x`
    .replace(/\[param\s+(\w+)\]/g, '`$1`')
    // Convert [member x] to `x`
    .replace(/\[member\s+(\w+)\]/g, '`$1`')
    // Convert [method x] to `x()`
    .replace(/\[method\s+(\w+)\]/g, '`$1()`')
    // Convert [signal x] to `x` signal
    .replace(/\[signal\s+(\w+)\]/g, '`$1` signal')
    // Convert [constant x] to `x`
    .replace(/\[constant\s+([^\]]+)\]/g, '`$1`')
    // Convert [ClassName] to ClassName
    .replace(/\[([A-Z]\w+)\]/g, '$1')
    // Convert [enum X.Y] to X.Y
    .replace(/\[enum\s+([^\]]+)\]/g, '$1')
    // Remove other tags
    .replace(/\[url[^\]]*\](.*?)\[\/url\]/g, '$1')
    .replace(/\[color[^\]]*\](.*?)\[\/color\]/g, '$1')
    .replace(/\[\/?[a-z_]+\]/g, '')
    // Clean up whitespace
    .replace(/\t+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Truncate description to a reasonable length
 */
function truncate(text: string, maxLen: number = 200): string {
  const cleaned = stripBBCode(text).replace(/\n/g, ' ').replace(/\s+/g, ' ');
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3).replace(/\s+\S*$/, '') + '...';
}

/**
 * Format a method signature
 */
function formatMethod(m: GodotMethod): string {
  const params = m.params.map(p => {
    let s = `${p.name}: ${p.type}`;
    if (p.default !== undefined) s += ` = ${p.default}`;
    return s;
  }).join(', ');

  let sig = `${m.name}(${params}) -> ${m.returnType}`;
  if (m.qualifiers) sig += ` [${m.qualifiers}]`;

  const desc = truncate(m.description);
  return desc ? `- ${sig} — ${desc}` : `- ${sig}`;
}

/**
 * Format a property
 */
function formatProperty(p: GodotProperty): string {
  let sig = `${p.name}: ${p.type}`;
  if (p.default !== undefined) sig += ` = ${p.default}`;

  const desc = truncate(p.description);
  return desc ? `- ${sig} — ${desc}` : `- ${sig}`;
}

/**
 * Format a signal
 */
function formatSignal(s: GodotSignal): string {
  const params = s.params.map(p => `${p.name}: ${p.type}`).join(', ');
  const sig = `${s.name}(${params})`;

  const desc = truncate(s.description);
  return desc ? `- ${sig} — ${desc}` : `- ${sig}`;
}

/**
 * Format a constant
 */
function formatConstant(c: GodotConstant): string {
  let sig = `${c.name} = ${c.value}`;
  if (c.enum) sig += ` (${c.enum})`;

  const desc = truncate(c.description, 100);
  return desc ? `- ${sig} — ${desc}` : `- ${sig}`;
}

/**
 * Format a GodotClass as compact, LLM-friendly text
 */
export function formatClassAsText(cls: GodotClass): string {
  const lines: string[] = [];

  // Header
  const inheritance = cls.inherits ? ` (extends ${cls.inherits})` : '';
  lines.push(`# ${cls.name}${inheritance}`);
  lines.push('');

  // Brief description
  if (cls.brief) {
    lines.push(stripBBCode(cls.brief));
    lines.push('');
  }

  // Full description (truncated for very long ones)
  if (cls.description && cls.description !== cls.brief) {
    const desc = stripBBCode(cls.description);
    if (desc.length > 500) {
      lines.push(desc.slice(0, 500).replace(/\s+\S*$/, '') + '...');
    } else {
      lines.push(desc);
    }
    lines.push('');
  }

  // Properties
  if (cls.properties.length > 0) {
    lines.push('## Properties');
    for (const p of cls.properties) {
      lines.push(formatProperty(p));
    }
    lines.push('');
  }

  // Methods
  if (cls.methods.length > 0) {
    lines.push('## Methods');
    for (const m of cls.methods) {
      lines.push(formatMethod(m));
    }
    lines.push('');
  }

  // Signals
  if (cls.signals.length > 0) {
    lines.push('## Signals');
    for (const s of cls.signals) {
      lines.push(formatSignal(s));
    }
    lines.push('');
  }

  // Constants (group by enum if possible)
  if (cls.constants.length > 0) {
    lines.push('## Constants');
    for (const c of cls.constants) {
      lines.push(formatConstant(c));
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
