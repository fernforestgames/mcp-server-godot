import { spawn } from "child_process";
import { EventEmitter } from "events";
import { Server, Socket } from "net";
import { fileURLToPath } from "url";

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

      // First send break command to pause execution, then evaluate
      console.error('Sending break command to pause execution');
      this.sendBreakCommand().then(() => {
        console.error('Break command sent, waiting before evaluate...');
        // Wait a bit for the break to take effect
        setTimeout(() => {
          console.error('Sending evaluate command with script:', script);
          this.sendEvaluateCommand(script).catch((error) => {
            console.error('Failed to send evaluate command:', error);
            reject(error);
          });
        }, 500);
      }).catch((error) => {
        console.error('Failed to send break command:', error);
        reject(error);
      });
    });
  }

  private generateScreenshotScript(format: string, quality?: number): string {
    const qualityParam = format === 'jpg' && quality !== undefined ? `, ${quality / 100.0}` : '';

    // Test with just returning a simple value instead of calling print
    return `"screenshot_test"`;
  }

  private async sendBreakCommand(): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to Godot debugger');
    }

    // Send break command to pause execution
    const messageArray = ["break", 0, []];
    const encodedMessage = await this.encodeVariantMessage(messageArray);
    this.socket.write(encodedMessage);
  }

  private async sendEvaluateCommand(expression: string): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to Godot debugger');
    }

    // Use the Variant codec to properly encode the message
    const messageArray = ["evaluate", 0, [expression, 0]];
    const encodedMessage = await this.encodeVariantMessage(messageArray);

    this.socket.write(encodedMessage);
  }

  private async encodeVariantMessage(messageArray: any[]): Promise<Buffer> {

    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(messageArray);

      const godotPath = process.env['GODOT_PATH'] || 'godot';
      const godot = spawn(godotPath, [
        '--headless',
        '--script', this.variantCodecPath(),
        '--action', 'encode',
        '--data', jsonData
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      godot.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      godot.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      godot.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Variant encoding failed: ${stderr}`));
          return;
        }

        // Look for HEX: output
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.startsWith('HEX:')) {
            const hexData = line.substring(4);
            const buffer = Buffer.from(hexData, 'hex');
            resolve(buffer);
            return;
          }
        }
        reject(new Error('No encoded data found in output'));
      });

      godot.on('error', (error) => {
        reject(new Error(`Failed to spawn Godot for encoding: ${error}`));
      });
    });
  }

  private handleData(data: Buffer): void {
    this.messageBuffer = Buffer.concat([this.messageBuffer, data]);

    // Process complete messages - Godot protocol: [4 bytes: size][message data]
    while (this.messageBuffer.length >= 4) {
      const messageSize = this.messageBuffer.readUInt32LE(0);

      if (this.messageBuffer.length >= 4 + messageSize) {
        const messageData = this.messageBuffer.subarray(4, 4 + messageSize);
        this.messageBuffer = this.messageBuffer.subarray(4 + messageSize);

        // Handle message asynchronously (don't await to avoid blocking)
        this.handleMessage(messageData).catch((error) => {
          console.error('Error handling message:', error);
        });
      } else {
        break; // Wait for more data
      }
    }
  }

  private async handleMessage(messageData: Buffer): Promise<void> {
    try {
      // Decode the Variant message using our helper
      const decodedMessage = await this.decodeVariantMessage(messageData);
      console.error('Decoded message:', JSON.stringify(decodedMessage));

      // Check if this is an output message that might contain our screenshot data
      if (Array.isArray(decodedMessage) && decodedMessage.length >= 3) {
        const [messageName, , data] = decodedMessage;
        console.error('Message name:', messageName, 'Data:', JSON.stringify(data));

        if (messageName === 'output' && Array.isArray(data) && data.length >= 1) {
          const messages = data[0];
          console.error('Output messages:', JSON.stringify(messages));
          if (Array.isArray(messages)) {
            const outputText = messages.join('\n');
            console.error('Joined output text:', outputText);
            this.parseScreenshotOutput(outputText);
          }
        }
      } else {
        console.error('Received non-array message or malformed array:', typeof decodedMessage, decodedMessage);
        // This might be a single value response - not the protocol format we expect
        // Could be a connection handshake, error code, or invalid state
      }
    } catch (error) {
      console.error('Error parsing message:', error);

      // Fallback: try to parse as text for our print statements
      const message = messageData.toString('utf8');
      console.error('Fallback parsing raw message:', message);
      this.parseScreenshotOutput(message);
    }

    this.emit('message', { data: messageData });
  }
  
  private variantCodecPath(): string {
    const url = new URL('../scripts/variant_codec.gd', import.meta.url);
    return fileURLToPath(url);
  }

  private async decodeVariantMessage(messageData: Buffer): Promise<any> {
    return new Promise((resolve, reject) => {
      const hexData = 'HEX:' + messageData.toString('hex');

      const godotPath = process.env['GODOT_PATH'] || 'godot';
      const godot = spawn(godotPath, [
        '--headless',
        '--script', this.variantCodecPath(),
        '--action', 'decode',
        '--data', hexData
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      godot.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      godot.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      godot.on('close', (code) => {
        console.error('Variant decoder exit code:', code);
        console.error('Variant decoder stdout:', stdout);
        console.error('Variant decoder stderr:', stderr);

        if (code !== 0) {
          reject(new Error(`Variant decoding failed: ${stderr}`));
          return;
        }

        // Look for JSON: output
        const lines = stdout.split('\n');
        console.error('Variant decoder output lines:', lines);
        for (const line of lines) {
          if (line.startsWith('JSON:')) {
            const jsonData = line.substring(5);
            console.error('Found JSON data:', jsonData);
            try {
              const parsed = JSON.parse(jsonData);
              resolve(parsed);
              return;
            } catch (error) {
              reject(new Error(`Failed to parse decoded JSON: ${error}`));
              return;
            }
          }
        }
        reject(new Error('No decoded data found in output'));
      });

      godot.on('error', (error) => {
        reject(new Error(`Failed to spawn Godot for decoding: ${error}`));
      });
    });
  }

  private parseScreenshotOutput(text: string): void {
    console.error('Parsing screenshot output:', JSON.stringify(text));
    const lines = text.split('\n');
    console.error('Split into lines:', lines.length, 'lines');
    let screenshotStartIndex = -1;
    let screenshotEndIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.error(`Line ${i}:`, JSON.stringify(line));
      if (line && line.trim() === 'SCREENSHOT_START') {
        screenshotStartIndex = i;
        console.error('Found SCREENSHOT_START at line', i);
      } else if (line && line.trim() === 'SCREENSHOT_END') {
        screenshotEndIndex = i;
        console.error('Found SCREENSHOT_END at line', i);
        break;
      }
    }

    if (screenshotStartIndex !== -1 && screenshotEndIndex !== -1) {
      console.error('Extracting screenshot data from lines', screenshotStartIndex + 1, 'to', screenshotEndIndex);
      const base64Data = lines.slice(screenshotStartIndex + 1, screenshotEndIndex).join('');
      console.error('Base64 data length:', base64Data.length);
      try {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        console.error('Successfully created image buffer, size:', imageBuffer.length);
        this.emit('screenshot_data', imageBuffer);
      } catch (error) {
        console.error('Failed to decode base64:', error);
        this.emit('error', new Error(`Failed to decode screenshot data: ${error}`));
      }
    } else {
      console.error('Screenshot markers not found. Start:', screenshotStartIndex, 'End:', screenshotEndIndex);
    }
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
