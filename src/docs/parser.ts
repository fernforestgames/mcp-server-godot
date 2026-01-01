// Parse Godot XML documentation into TypeScript types
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import type {
  GodotClass,
  GodotMethod,
  GodotMethodParam,
  GodotProperty,
  GodotSignal,
  GodotConstant,
  GodotThemeItem,
} from './types.js';

// Configure XML parser to preserve attributes
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => {
    // These elements can appear multiple times
    return ['method', 'member', 'signal', 'constant', 'param', 'theme_item', 'link'].includes(name);
  },
});

/**
 * Parse a single Godot XML documentation file
 */
export function parseClassXml(xmlPath: string): GodotClass | null {
  try {
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const parsed = parser.parse(xml);

    const classData = parsed.class;
    if (!classData) {
      return null;
    }

    return {
      name: classData['@_name'] || '',
      inherits: classData['@_inherits'] || undefined,
      brief: extractText(classData.brief_description),
      description: extractText(classData.description),
      keywords: classData['@_keywords']?.split(',').map((k: string) => k.trim()) || [],
      tutorials: parseTutorials(classData.tutorials),
      methods: parseMethods(classData.methods),
      properties: parseMembers(classData.members),
      signals: parseSignals(classData.signals),
      constants: parseConstants(classData.constants),
      themeItems: parseThemeItems(classData.theme_items),
    };
  } catch (error) {
    console.error(`Failed to parse ${xmlPath}:`, error);
    return null;
  }
}

/**
 * Extract text content from an element (handles both string and object with #text)
 */
function extractText(element: unknown): string {
  if (!element) return '';
  if (typeof element === 'string') return element.trim();
  if (typeof element === 'object' && element !== null && '#text' in element) {
    return String((element as Record<string, unknown>)['#text']).trim();
  }
  return '';
}

/**
 * Parse tutorials section
 */
function parseTutorials(tutorials: unknown): { title: string; link: string }[] {
  if (!tutorials) return [];

  const links = (tutorials as Record<string, unknown>)['link'];
  if (!links) return [];

  const linksArray = Array.isArray(links) ? links : [links];
  return linksArray.map((link: unknown) => {
    if (typeof link === 'string') {
      return { title: '', link };
    }
    const linkObj = link as Record<string, unknown>;
    return {
      title: String(linkObj['@_title'] || ''),
      link: extractText(linkObj) || String(linkObj['#text'] || ''),
    };
  });
}

/**
 * Parse methods section
 */
function parseMethods(methods: unknown): GodotMethod[] {
  if (!methods) return [];

  const methodList = (methods as Record<string, unknown>)['method'];
  if (!methodList) return [];

  const methodsArray = Array.isArray(methodList) ? methodList : [methodList];
  return methodsArray.map((method: unknown): GodotMethod => {
    const m = method as Record<string, unknown>;
    return {
      name: String(m['@_name'] || ''),
      returnType: parseReturnType(m['return']),
      params: parseParams(m['param']),
      description: extractText(m['description']),
      qualifiers: m['@_qualifiers'] ? String(m['@_qualifiers']) : undefined,
    };
  });
}

/**
 * Parse return type
 */
function parseReturnType(ret: unknown): string {
  if (!ret) return 'void';
  const r = ret as Record<string, unknown>;
  return String(r['@_type'] || 'void');
}

/**
 * Parse method/signal parameters
 */
function parseParams(params: unknown): GodotMethodParam[] {
  if (!params) return [];

  const paramsArray = Array.isArray(params) ? params : [params];
  return paramsArray.map((param: unknown): GodotMethodParam => {
    const p = param as Record<string, unknown>;
    return {
      name: String(p['@_name'] || ''),
      type: String(p['@_type'] || 'Variant'),
      default: p['@_default'] ? String(p['@_default']) : undefined,
    };
  });
}

/**
 * Parse members (properties) section
 */
function parseMembers(members: unknown): GodotProperty[] {
  if (!members) return [];

  const memberList = (members as Record<string, unknown>)['member'];
  if (!memberList) return [];

  const membersArray = Array.isArray(memberList) ? memberList : [memberList];
  return membersArray.map((member: unknown): GodotProperty => {
    const m = member as Record<string, unknown>;
    return {
      name: String(m['@_name'] || ''),
      type: String(m['@_type'] || 'Variant'),
      default: m['@_default'] ? String(m['@_default']) : undefined,
      setter: m['@_setter'] ? String(m['@_setter']) : undefined,
      getter: m['@_getter'] ? String(m['@_getter']) : undefined,
      description: extractText(m),
    };
  });
}

/**
 * Parse signals section
 */
function parseSignals(signals: unknown): GodotSignal[] {
  if (!signals) return [];

  const signalList = (signals as Record<string, unknown>)['signal'];
  if (!signalList) return [];

  const signalsArray = Array.isArray(signalList) ? signalList : [signalList];
  return signalsArray.map((signal: unknown): GodotSignal => {
    const s = signal as Record<string, unknown>;
    return {
      name: String(s['@_name'] || ''),
      params: parseParams(s['param']),
      description: extractText(s['description']),
    };
  });
}

/**
 * Parse constants section
 */
function parseConstants(constants: unknown): GodotConstant[] {
  if (!constants) return [];

  const constantList = (constants as Record<string, unknown>)['constant'];
  if (!constantList) return [];

  const constantsArray = Array.isArray(constantList) ? constantList : [constantList];
  return constantsArray.map((constant: unknown): GodotConstant => {
    const c = constant as Record<string, unknown>;
    return {
      name: String(c['@_name'] || ''),
      value: String(c['@_value'] || '0'),
      enum: c['@_enum'] ? String(c['@_enum']) : undefined,
      description: extractText(c),
    };
  });
}

/**
 * Parse theme items section
 */
function parseThemeItems(themeItems: unknown): GodotThemeItem[] {
  if (!themeItems) return [];

  const itemList = (themeItems as Record<string, unknown>)['theme_item'];
  if (!itemList) return [];

  const itemsArray = Array.isArray(itemList) ? itemList : [itemList];
  return itemsArray.map((item: unknown): GodotThemeItem => {
    const t = item as Record<string, unknown>;
    return {
      name: String(t['@_name'] || ''),
      type: String(t['@_data_type'] || t['@_type'] || 'unknown'),
      dataType: t['@_data_type'] ? String(t['@_data_type']) : undefined,
      default: t['@_default'] ? String(t['@_default']) : undefined,
      description: extractText(t),
    };
  });
}
