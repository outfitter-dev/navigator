/**
 * Project Detection
 *
 * Utilities for detecting project root directories.
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// ============================================================================
// Project Markers
// ============================================================================

/**
 * Files/directories that indicate a project root.
 */
const PROJECT_MARKERS = [
	'.git',
	'package.json',
	'Cargo.toml',
	'pyproject.toml',
	'go.mod',
	'deno.json',
]

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect the project root by walking up the directory tree.
 *
 * Looks for common project markers (.git, package.json, etc.).
 *
 * @param startPath - Directory to start searching from (defaults to cwd)
 * @returns Absolute path to project root, or null if not found
 */
export function detectProjectRoot(
	startPath: string = process.cwd(),
): string | null {
	let current = resolve(startPath)
	const root = dirname(current)

	// Walk up until we hit the filesystem root
	while (current !== root) {
		for (const marker of PROJECT_MARKERS) {
			if (existsSync(join(current, marker))) {
				return current
			}
		}
		current = dirname(current)
	}

	// Check root level as well
	for (const marker of PROJECT_MARKERS) {
		if (existsSync(join(root, marker))) {
			return root
		}
	}

	return null
}

/**
 * Require a project root to exist, throwing if not found.
 *
 * @param startPath - Directory to start searching from (defaults to cwd)
 * @returns Absolute path to project root
 * @throws Error if no project root is found
 */
export function requireProjectRoot(startPath?: string): string {
	const root = detectProjectRoot(startPath)
	if (!root) {
		throw new Error('Not in a project directory (no .git, package.json, etc.)')
	}
	return root
}

/**
 * Check if a path is within a project directory.
 *
 * @param path - Path to check
 * @returns True if the path is within a detectable project
 */
export function isInProject(path: string): boolean {
	return detectProjectRoot(path) !== null
}
