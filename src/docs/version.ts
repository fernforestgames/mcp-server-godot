// Detect Godot version and map to GitHub ref
import { execSync } from 'child_process';
import { godotPath } from '../config.js';

export interface GodotVersionInfo {
  major: number;
  minor: number;
  patch: number;
  status: string; // stable, beta, alpha, dev, rc
  full: string;   // Original version string
}

/**
 * Get the Godot version from the executable
 */
export function getGodotVersion(): GodotVersionInfo {
  try {
    const output = execSync(`"${godotPath}" --version`, {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

    // Godot version format: "4.3.stable.official.77dcf97d8"
    // or "4.3.1.stable.official.77dcf97d8"
    const parts = output.split('.');

    const major = parseInt(parts[0] || '4', 10) || 4;
    const minor = parseInt(parts[1] || '0', 10) || 0;

    // Check if third part is a number (patch) or status
    let patch = 0;
    let statusIndex = 2;
    if (parts[2] && /^\d+$/.test(parts[2])) {
      patch = parseInt(parts[2], 10);
      statusIndex = 3;
    }

    const status = parts[statusIndex] || 'stable';

    return {
      major,
      minor,
      patch,
      status,
      full: output,
    };
  } catch (error) {
    console.error('Failed to get Godot version:', error);
    // Default to latest stable if we can't detect
    return {
      major: 4,
      minor: 3,
      patch: 0,
      status: 'stable',
      full: '4.3.stable',
    };
  }
}

/**
 * Map a Godot version to a GitHub ref (tag or branch)
 *
 * Stable versions: Use the exact tag (e.g., "4.5.1-stable")
 * Dev/master builds: "master" branch
 *
 * Tags are preferred because they're immutable and match the exact version.
 */
export function versionToGitRef(version: GodotVersionInfo): string {
  // Dev, alpha, beta, rc builds use master
  if (version.status !== 'stable') {
    return 'master';
  }

  // Stable versions use the exact tag: X.Y.Z-stable
  // For X.Y.0 releases, Godot uses "X.Y-stable" not "X.Y.0-stable"
  if (version.patch === 0) {
    return `${version.major}.${version.minor}-stable`;
  }
  return `${version.major}.${version.minor}.${version.patch}-stable`;
}

/**
 * Get a cache-safe version string (used for cache directory naming)
 */
export function versionToCacheKey(version: GodotVersionInfo): string {
  if (version.status !== 'stable') {
    // For non-stable, include more version info to differentiate
    return `${version.major}.${version.minor}.${version.patch}-${version.status}`;
  }
  return `${version.major}.${version.minor}-stable`;
}
