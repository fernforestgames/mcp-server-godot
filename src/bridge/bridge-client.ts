/**
 * Bridge client for communicating with Godot addon via stdin/stdout
 */

import type { ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { encodeMessage, extractMessages } from "./protocol.js";
import type { BridgeMessage, HandshakeResponse } from "./types.js";

interface PendingRequest {
  resolve: (response: BridgeMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface BridgeClientEvents {
  event: (msg: BridgeMessage) => void;
  disconnected: () => void;
  stdout: (text: string) => void;
}

export class BridgeClient extends EventEmitter<BridgeClientEvents> {
  private process: ChildProcess;
  private buffer: string = "";
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private _isConnected: boolean = false;
  private _capabilities: string[] = [];
  private _version: string = "";

  constructor(process: ChildProcess) {
    super();
    this.process = process;
    this.setupStdoutParser();
    this.setupProcessHandlers();
  }

  private setupStdoutParser(): void {
    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });
  }

  private setupProcessHandlers(): void {
    this.process.on("exit", () => {
      this._isConnected = false;
      this.rejectAllPending(new Error("Process exited"));
      this.emit("disconnected");
    });

    this.process.on("error", () => {
      this._isConnected = false;
      this.rejectAllPending(new Error("Process error"));
      this.emit("disconnected");
    });
  }

  private processBuffer(): void {
    const { messages, remaining, nonBridgeText } = extractMessages(this.buffer);
    this.buffer = remaining;

    // Emit non-bridge text as stdout for capture
    if (nonBridgeText) {
      this.emit("stdout", nonBridgeText);
    }

    // Handle each decoded message
    for (const msg of messages) {
      this.handleMessage(msg);
    }
  }

  private handleMessage(msg: BridgeMessage): void {
    if (msg.type === "response") {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);

        if (msg.error) {
          pending.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        } else {
          pending.resolve(msg);
        }
      }
    } else if (msg.type === "event") {
      this.emit("event", msg);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Send a request to the Godot addon and wait for response
   */
  async sendRequest<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs = 5000
  ): Promise<T> {
    if (!this._isConnected && command !== "handshake") {
      throw new Error("Bridge not connected");
    }

    const id = randomUUID();
    const msg: BridgeMessage = { id, type: "request", command, payload };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (response) => resolve(response.payload as T),
        reject,
        timeout,
      });

      const encoded = encodeMessage(msg);
      this.process.stdin?.write(encoded + "\n");
    });
  }

  /**
   * Attempt to establish connection with the addon via handshake
   */
  async handshake(timeoutMs = 2000): Promise<boolean> {
    try {
      const response = await this.sendRequest<HandshakeResponse>(
        "handshake",
        { version: "1.0" },
        timeoutMs
      );

      this._isConnected = true;
      this._capabilities = response.capabilities || [];
      this._version = response.version || "unknown";

      return true;
    } catch {
      this._isConnected = false;
      return false;
    }
  }

  /**
   * Check if addon supports a specific capability
   */
  hasCapability(cap: string): boolean {
    return this._capabilities.includes(cap);
  }

  /**
   * Whether the bridge is connected to the addon
   */
  get connected(): boolean {
    return this._isConnected;
  }

  /**
   * List of capabilities reported by the addon
   */
  get capabilities(): string[] {
    return [...this._capabilities];
  }

  /**
   * Version string reported by the addon
   */
  get version(): string {
    return this._version;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.rejectAllPending(new Error("Bridge destroyed"));
    this.removeAllListeners();
  }
}
