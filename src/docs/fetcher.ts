// Download and cache Godot documentation from GitHub
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import envPaths from 'env-paths';
import { getGodotVersion, versionToGitRef, versionToCacheKey } from './version.js';

const paths = envPaths('mcp-server-godot', { suffix: '' });

/**
 * Get the cache directory for a specific Godot version
 */
export function getCacheDir(versionKey: string): string {
  return path.join(paths.cache, 'docs', versionKey);
}

/**
 * Check if docs are cached for a version
 */
export function isCached(versionKey: string): boolean {
  const cacheDir = getCacheDir(versionKey);
  if (!fs.existsSync(cacheDir)) {
    return false;
  }

  // Check if we have at least some XML files
  const files = fs.readdirSync(cacheDir);
  const xmlFiles = files.filter(f => f.endsWith('.xml'));
  return xmlFiles.length > 100; // Expect 1000+ files, but 100 is a sanity check
}

/**
 * Download file with streaming (for large files)
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (urlString: string) => {
      https.get(urlString, { headers: { 'User-Agent': 'mcp-server-godot' } }, async (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            request(redirectUrl);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        try {
          const fileStream = createWriteStream(destPath);
          await pipeline(res, fileStream);
          resolve();
        } catch (err) {
          reject(err);
        }
      }).on('error', reject);
    };
    request(url);
  });
}

/**
 * Fetch documentation for a specific Godot version
 * Downloads from GitHub as a tarball and extracts doc/classes/*.xml
 */
export async function fetchDocs(versionKey?: string): Promise<string> {
  const version = getGodotVersion();
  const gitRef = versionToGitRef(version);
  const cacheKey = versionKey || versionToCacheKey(version);
  const cacheDir = getCacheDir(cacheKey);

  // Check if already cached
  if (isCached(cacheKey)) {
    console.log(`Using cached docs for ${cacheKey}`);
    return cacheDir;
  }

  console.log(`Fetching Godot docs for version ${version.full} (ref: ${gitRef})...`);

  // Create cache directory
  fs.mkdirSync(cacheDir, { recursive: true });

  // Download tarball from GitHub
  // For tags: https://github.com/godotengine/godot/archive/refs/tags/4.5.1-stable.tar.gz
  // For branches (master): https://github.com/godotengine/godot/archive/refs/heads/master.tar.gz
  const refType = gitRef === 'master' ? 'heads' : 'tags';
  const tarballUrl = `https://github.com/godotengine/godot/archive/refs/${refType}/${gitRef}.tar.gz`;
  const tarballPath = path.join(paths.temp, `godot-docs-${cacheKey}.tar.gz`);

  // Ensure temp directory exists
  fs.mkdirSync(paths.temp, { recursive: true });

  try {
    console.log(`Downloading from ${tarballUrl}...`);
    await downloadFile(tarballUrl, tarballPath);

    console.log('Extracting documentation files...');

    // Extract just the doc/classes directory
    // The tarball structure is: godot-4.3-stable/doc/classes/*.xml
    const tar = await import('tar');
    await tar.extract({
      file: tarballPath,
      cwd: cacheDir,
      strip: 3, // Remove "godot-X.Y-stable/doc/classes/" prefix
      filter: (entryPath) => {
        // Only extract files from doc/classes/
        return entryPath.includes('/doc/classes/') && entryPath.endsWith('.xml');
      },
    });

    // Verify extraction
    const files = fs.readdirSync(cacheDir);
    const xmlFiles = files.filter(f => f.endsWith('.xml'));
    console.log(`Extracted ${xmlFiles.length} documentation files`);

    if (xmlFiles.length === 0) {
      throw new Error('No XML files were extracted from the archive');
    }

    return cacheDir;
  } finally {
    // Clean up tarball
    if (fs.existsSync(tarballPath)) {
      fs.unlinkSync(tarballPath);
    }
  }
}

/**
 * List all XML files in the cache directory
 */
export function listCachedDocs(cacheDir: string): string[] {
  if (!fs.existsSync(cacheDir)) {
    return [];
  }

  return fs.readdirSync(cacheDir)
    .filter(f => f.endsWith('.xml'))
    .map(f => path.join(cacheDir, f));
}
