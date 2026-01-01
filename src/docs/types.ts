// Type definitions for parsed Godot XML documentation

export interface GodotMethodParam {
  name: string;
  type: string;
  default?: string;
}

export interface GodotMethod {
  name: string;
  returnType: string;
  params: GodotMethodParam[];
  description: string;
  qualifiers?: string; // virtual, const, static, vararg
}

export interface GodotProperty {
  name: string;
  type: string;
  default?: string;
  setter?: string;
  getter?: string;
  description: string;
}

export interface GodotSignal {
  name: string;
  params: GodotMethodParam[];
  description: string;
}

export interface GodotConstant {
  name: string;
  value: string;
  enum?: string;
  description: string;
}

export interface GodotThemeItem {
  name: string;
  type: string; // color, constant, font, font_size, icon, style
  dataType?: string;
  default?: string;
  description: string;
}

export interface GodotClass {
  name: string;
  inherits?: string;
  brief: string;
  description: string;
  keywords?: string[];
  tutorials: { title: string; link: string }[];
  methods: GodotMethod[];
  properties: GodotProperty[];
  signals: GodotSignal[];
  constants: GodotConstant[];
  themeItems: GodotThemeItem[];
}

// Search result types
export interface SearchMatch {
  className: string;
  matchType: 'class' | 'method' | 'property' | 'signal' | 'constant';
  name: string;
  excerpt: string;
  score: number;
}
