/**
 * Protocol encoding/decoding for bridge messages
 */

import type { BridgeMessage } from "./types.js";

const PREFIX = "[MCP_BRIDGE:";
const SUFFIX = "]";

/**
 * Encode a bridge message for transmission via stdin
 */
export function encodeMessage(msg: BridgeMessage): string {
  const json = JSON.stringify(msg);
  const base64 = Buffer.from(json, "utf-8").toString("base64");
  return PREFIX + base64 + SUFFIX;
}

/**
 * Decode a bridge message received via stdout
 * Returns null if the string is not a valid bridge message
 */
export function decodeMessage(line: string): BridgeMessage | null {
  if (!line.startsWith(PREFIX) || !line.endsWith(SUFFIX)) {
    return null;
  }

  const base64 = line.slice(PREFIX.length, -SUFFIX.length);

  try {
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as BridgeMessage;

    // Basic validation
    if (
      typeof parsed.id !== "string" ||
      !["request", "response", "event"].includes(parsed.type) ||
      typeof parsed.command !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Check if a string contains a bridge message marker
 */
export function containsBridgeMessage(text: string): boolean {
  return text.includes(PREFIX);
}

/**
 * Extract bridge messages from a text buffer, returning both messages and remaining text
 */
export function extractMessages(buffer: string): {
  messages: BridgeMessage[];
  remaining: string;
  nonBridgeText: string;
} {
  const messages: BridgeMessage[] = [];
  let remaining = buffer;
  let nonBridgeText = "";

  while (true) {
    const startIdx = remaining.indexOf(PREFIX);

    if (startIdx === -1) {
      // No more markers, everything is non-bridge text
      nonBridgeText += remaining;
      remaining = "";
      break;
    }

    // Collect text before the marker as non-bridge text
    if (startIdx > 0) {
      nonBridgeText += remaining.slice(0, startIdx);
    }

    const endIdx = remaining.indexOf(SUFFIX, startIdx);

    if (endIdx === -1) {
      // Incomplete message, keep it in remaining
      remaining = remaining.slice(startIdx);
      break;
    }

    // Extract the full message including markers
    const fullMessage = remaining.slice(startIdx, endIdx + SUFFIX.length);
    remaining = remaining.slice(endIdx + SUFFIX.length);

    const decoded = decodeMessage(fullMessage);
    if (decoded) {
      messages.push(decoded);
    }
  }

  return { messages, remaining, nonBridgeText };
}

export { PREFIX, SUFFIX };
