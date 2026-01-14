/**
 * Project barrel export
 *
 * Re-exports project detection utilities.
 */

export { detectProjectRoot, isInProject, requireProjectRoot } from './detect'

import { detectProjectRoot } from './detect'

/**
 * Get the project root, falling back to cwd if not detected.
 *
 * @param startPath - Directory to start searching from (defaults to cwd)
 * @returns Absolute path to project root, or cwd if not found
 */
export function getProjectRoot(startPath?: string): string {
	return detectProjectRoot(startPath) ?? process.cwd()
}
