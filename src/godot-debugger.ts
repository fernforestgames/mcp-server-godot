import { Socket, Server } from "net";
import { EventEmitter } from "events";

export interface GodotDebuggerOptions {
  host?: string;
  port: number;
  timeout?: number;
}

export interface ScreenshotOptions {
  format?: 'png' | 'jpg';
  quality?: number; // For JPG format (0-100)
}

export class GodotRemoteDebugger extends EventEmitter {
  private socket: Socket | null = null;
  private server: Server | null = null;
  private options: Required<GodotDebuggerOptions>;
  private connected = false;
  private messageBuffer = Buffer.alloc(0);

  constructor(options: GodotDebuggerOptions) {
    super();
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port,
      timeout: options.timeout || 5000
    };
  }

  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve();
        return;
      }

      this.server = new Server();

      const timeoutId = setTimeout(() => {
        this.server?.close();
        reject(new Error(`No connection after ${this.options.timeout}ms`));
      }, this.options.timeout);

      this.server.on('connection', (socket) => {
        clearTimeout(timeoutId);
        this.socket = socket;
        this.connected = true;
        this.emit('connected');
        resolve();

        socket.on('data', (data) => {
          this.handleData(data);
        });

        socket.on('error', (error) => {
          this.connected = false;
          this.emit('error', error);
        });

        socket.on('close', () => {
          this.connected = false;
          this.emit('disconnected');
        });
      });

      this.server.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        this.emit('listening');
      });
    });
  }

  async waitForConnection(timeout: number = 10000): Promise<void> {
    if (this.connected) {
      return;
    }

    if (!this.server) {
      await this.startServer();
    }

    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        this.off('connected', onConnected);
        reject(new Error(`Timeout waiting for Godot connection after ${timeout}ms`));
      }, timeout);

      const onConnected = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      this.once('connected', onConnected);
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      // Close socket connection
      if (this.socket && this.connected) {
        this.socket.once('close', () => {
          this.connected = false;
          this.closeServer().then(resolve);
        });
        this.socket.end();
      } else {
        this.closeServer().then(resolve);
      }
    });
  }

  private async closeServer(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  async captureScreenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to Godot debugger');
    }

    const format = options.format || 'png';
    const script = this.generateScreenshotScript(format, options.quality);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Screenshot capture timeout'));
      }, this.options.timeout);

      // Listen for screenshot response
      const onScreenshotData = (data: Buffer) => {
        clearTimeout(timeoutId);
        this.off('screenshot_data', onScreenshotData);
        this.off('error', onError);
        resolve(data);
      };

      const onError = (error: Error) => {
        clearTimeout(timeoutId);
        this.off('screenshot_data', onScreenshotData);
        this.off('error', onError);
        reject(error);
      };

      this.once('screenshot_data', onScreenshotData);
      this.once('error', onError);

      // Send the screenshot command
      this.sendDebugCommand('script', script);
    });
  }

  private generateScreenshotScript(format: string, quality?: number): string {
    const qualityParam = format === 'jpg' && quality !== undefined ? `, ${quality / 100.0}` : '';

    return `
var viewport = get_viewport()
var image = viewport.get_texture().get_image()
var buffer = image.save_${format}_to_buffer(${qualityParam})
print("SCREENSHOT_START")
print(Marshalls.raw_to_base64(buffer))
print("SCREENSHOT_END")
`;
  }

  private sendDebugCommand(_type: string, data: string): void {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to Godot debugger');
    }

    // Godot remote debugger protocol: [message_type:4][message_size:4][message_data]
    const messageData = Buffer.from(data, 'utf8');
    const messageType = Buffer.alloc(4);
    const messageSize = Buffer.alloc(4);

    // Set message type (script execution = 3)
    messageType.writeUInt32LE(3, 0);

    // Set message size
    messageSize.writeUInt32LE(messageData.length, 0);

    // Send the complete message
    const fullMessage = Buffer.concat([messageType, messageSize, messageData]);
    this.socket.write(fullMessage);
  }

  private handleData(data: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data]);

    // Process complete messages
    while (this.messageBuffer.length >= 8) {
      const messageType = this.messageBuffer.readUInt32LE(0);
      const messageSize = this.messageBuffer.readUInt32LE(4);

      if (this.messageBuffer.length >= 8 + messageSize) {
        const messageData = this.messageBuffer.subarray(8, 8 + messageSize);
        this.messageBuffer = this.messageBuffer.subarray(8 + messageSize);

        this.handleMessage(messageType, messageData);
      } else {
        break; // Wait for more data
      }
    }
  }

  private handleMessage(messageType: number, data: Buffer): void {
    const message = data.toString('utf8');

    // Look for screenshot data in stdout messages
    if (messageType === 1) { // stdout message type
      const lines = message.split('\n');
      let screenshotStartIndex = -1;
      let screenshotEndIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.trim() === 'SCREENSHOT_START') {
          screenshotStartIndex = i;
        } else if (line && line.trim() === 'SCREENSHOT_END') {
          screenshotEndIndex = i;
          break;
        }
      }

      if (screenshotStartIndex !== -1 && screenshotEndIndex !== -1) {
        const base64Data = lines.slice(screenshotStartIndex + 1, screenshotEndIndex).join('');
        try {
          const imageBuffer = Buffer.from(base64Data, 'base64');
          this.emit('screenshot_data', imageBuffer);
        } catch (error) {
          this.emit('error', new Error(`Failed to decode screenshot data: ${error}`));
        }
      }
    }

    this.emit('message', { type: messageType, data: message });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPort(): number {
    return this.options.port;
  }
}

export class DebugPortManager {
  private static instance: DebugPortManager;
  private usedPorts = new Set<number>();
  private basePort = 6007;
  private maxPort = 6100;

  static getInstance(): DebugPortManager {
    if (!DebugPortManager.instance) {
      DebugPortManager.instance = new DebugPortManager();
    }
    return DebugPortManager.instance;
  }

  allocatePort(): number {
    for (let port = this.basePort; port <= this.maxPort; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available debug ports');
  }

  releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  isPortInUse(port: number): boolean {
    return this.usedPorts.has(port);
  }
}