/**
 * Storage barrel export
 *
 * Re-exports all storage path utilities.
 * Default storage: ~/.local/share/navigator/{project-hash}/sessions/
 */

export {
	// XDG Base Directories
	getCacheHome,
	getConfigHome,
	getDataHome,
	// Navigator-specific directories
	getNavigatorCacheDir,
	getNavigatorConfigDir,
	getNavigatorDataDir,
	// Project hashing
	hashProjectPath,
	hashUrl,
	// Project-scoped paths
	getProjectDir,
	getSessionDir,
	getSessionsDir,
	// Marker paths
	getMarkerPath,
	getMarkersDir,
	getMarkerScreenshotsDir,
	getMarkerScreenshotPath,
	// Session file paths
	getSessionMetaPath,
	getStepsPath,
	// Session paths object
	getSessionPaths,
	type SessionPaths,
} from './paths'

// ============================================================================
// Additional Utilities
// ============================================================================

import { mkdirSync } from 'node:fs'

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export function ensureDir(dir: string): void {
	mkdirSync(dir, { recursive: true })
}
