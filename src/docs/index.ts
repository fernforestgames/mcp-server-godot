// Documentation index management with lazy initialization
import type { GodotClass } from './types.js';
import { fetchDocs, listCachedDocs } from './fetcher.js';
import { getGodotVersion, versionToCacheKey } from './version.js';
import { parseClassXml } from './parser.js';

/**
 * Singleton documentation index
 * Lazily initialized on first access
 */
class DocsIndex {
  private classes: Map<string, GodotClass> = new Map();
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private versionKey: string | null = null;

  /**
   * Ensure the index is initialized
   * Safe to call multiple times - will only initialize once
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // If already initializing, wait for it
    if (this.initializing) {
      return this.initializing;
    }

    this.initializing = this.initialize();
    await this.initializing;
  }

  private async initialize(): Promise<void> {
    try {
      console.log('Initializing Godot documentation index...');

      // Detect version and get cache key
      const version = getGodotVersion();
      this.versionKey = versionToCacheKey(version);
      console.log(`Godot version: ${version.full} (cache key: ${this.versionKey})`);

      // Fetch docs if needed
      const cacheDir = await fetchDocs(this.versionKey);

      // Parse all XML files
      const xmlFiles = listCachedDocs(cacheDir);
      console.log(`Parsing ${xmlFiles.length} documentation files...`);

      let parsed = 0;
      let failed = 0;

      for (const xmlPath of xmlFiles) {
        const godotClass = parseClassXml(xmlPath);
        if (godotClass) {
          this.classes.set(godotClass.name, godotClass);
          parsed++;
        } else {
          failed++;
        }
      }

      console.log(`Parsed ${parsed} classes (${failed} failed)`);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize documentation index:', error);
      throw error;
    }
  }

  /**
   * Get all class names
   */
  getAllClassNames(): string[] {
    return Array.from(this.classes.keys()).sort();
  }

  /**
   * Get a specific class by name
   */
  getClass(name: string): GodotClass | undefined {
    return this.classes.get(name);
  }

  /**
   * Get all classes
   */
  getAllClasses(): GodotClass[] {
    return Array.from(this.classes.values());
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the version key
   */
  getVersionKey(): string | null {
    return this.versionKey;
  }

  /**
   * Get class count
   */
  getClassCount(): number {
    return this.classes.size;
  }
}

// Export singleton instance
export const docsIndex = new DocsIndex();
