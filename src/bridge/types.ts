/**
 * Bridge message types for communication between MCP server and Godot addon
 */

export interface BridgeMessage {
  id: string;
  type: "request" | "response" | "event";
  command: string;
  payload: unknown;
  error?: BridgeError;
}

export interface BridgeError {
  code: string;
  message: string;
}

export interface HandshakePayload {
  version: string;
}

export interface HandshakeResponse {
  version: string;
  capabilities: string[];
}

export interface ScreenshotPayload {
  format?: "png" | "jpeg";
}

export interface ScreenshotResponse {
  data: string; // base64
  width: number;
  height: number;
}

export interface GetNodePayload {
  path: string;
}

export interface NodeInfo {
  name: string;
  type: string;
  path: string;
  properties: Record<string, unknown>;
  children?: NodeInfo[];
}

export interface SetPropertyPayload {
  path: string;
  property: string;
  value: unknown;
}

export interface CallMethodPayload {
  path: string;
  method: string;
  args?: unknown[];
}

export interface ChangeScenePayload {
  scenePath: string;
}

export interface InputActionPayload {
  action: string;
  pressed: boolean;
  strength?: number;
}

export interface InputKeyPayload {
  keycode: number;
  pressed: boolean;
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface InputMouseButtonPayload {
  button: number;
  pressed: boolean;
  position: { x: number; y: number };
}

export interface InputMouseMotionPayload {
  relative: { x: number; y: number };
  position?: { x: number; y: number };
}

export type InputPayload =
  | { type: "action"; data: InputActionPayload }
  | { type: "key"; data: InputKeyPayload }
  | { type: "mouse_button"; data: InputMouseButtonPayload }
  | { type: "mouse_motion"; data: InputMouseMotionPayload };
