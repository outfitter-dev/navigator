/**
 * Storage Path Utilities
 *
 * XDG Base Directory compliant paths for Navigator.
 * Default storage: ~/.local/share/navigator/{project-hash}/sessions/
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ============================================================================
// XDG Base Directory
// ============================================================================

/**
 * Get XDG data home directory.
 * Defaults to ~/.local/share
 */
export function getDataHome(): string {
	return process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share')
}

/**
 * Get XDG cache home directory.
 * Defaults to ~/.cache
 */
export function getCacheHome(): string {
	return process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache')
}

/**
 * Get XDG config home directory.
 * Defaults to ~/.config
 */
export function getConfigHome(): string {
	return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
}

// ============================================================================
// Navigator-specific Paths
// ============================================================================

/**
 * Get Navigator data directory.
 * ~/.local/share/navigator/
 */
export function getNavigatorDataDir(): string {
	return join(getDataHome(), 'navigator')
}

/**
 * Get Navigator cache directory.
 * ~/.cache/navigator/
 */
export function getNavigatorCacheDir(): string {
	return join(getCacheHome(), 'navigator')
}

/**
 * Get Navigator config directory.
 *
 * Checks paths in priority order and returns the first existing directory:
 * 1. $XDG_CONFIG_HOME/navigator/ (if XDG_CONFIG_HOME is set)
 * 2. ~/.config/navigator/
 * 3. ~/.navigator/ (simple fallback)
 *
 * If no directory exists, returns the XDG-compliant default path.
 */
export function getNavigatorConfigDir(): string {
	const home = homedir()
	const candidates: string[] = []

	// 1. XDG_CONFIG_HOME/navigator if explicitly set
	if (process.env.XDG_CONFIG_HOME) {
		candidates.push(join(process.env.XDG_CONFIG_HOME, 'navigator'))
	}

	// 2. ~/.config/navigator (default XDG location)
	const defaultXdgPath = join(home, '.config', 'navigator')
	// Avoid duplicate if XDG_CONFIG_HOME is ~/.config
	if (!candidates.includes(defaultXdgPath)) {
		candidates.push(defaultXdgPath)
	}

	// 3. ~/.navigator (simple fallback)
	candidates.push(join(home, '.navigator'))

	// Return first existing directory
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate
		}
	}

	// No existing dir found, return XDG-compliant default
	return defaultXdgPath
}

// ============================================================================
// Project Hashing
// ============================================================================

/**
 * Hash a project path to a short identifier.
 * Uses SHA256 and takes the first 12 characters.
 *
 * @param projectPath - Absolute path to project root
 * @returns 12-character hex string
 */
export function hashProjectPath(projectPath: string): string {
	return createHash('sha256').update(projectPath).digest('hex').slice(0, 12)
}

/**
 * Hash a URL to a short identifier.
 * Uses SHA256 and takes the first 4 characters.
 *
 * @param url - URL to hash
 * @returns 4-character hex string
 */
export function hashUrl(url: string): string {
	return createHash('sha256').update(url).digest('hex').slice(0, 4)
}

// ============================================================================
// Project-scoped Paths
// ============================================================================

/**
 * Get project data directory.
 * ~/.local/share/navigator/{project-hash}/
 *
 * @param projectPath - Absolute path to project root
 */
export function getProjectDir(projectPath: string): string {
	const hash = hashProjectPath(projectPath)
	return join(getNavigatorDataDir(), hash)
}

/**
 * Get sessions directory for a project.
 * ~/.local/share/navigator/{project-hash}/sessions/
 *
 * @param projectPath - Absolute path to project root
 */
export function getSessionsDir(projectPath: string): string {
	return join(getProjectDir(projectPath), 'sessions')
}

/**
 * Get a specific session directory.
 * ~/.local/share/navigator/{project-hash}/sessions/{session-id}/
 *
 * @param projectPath - Absolute path to project root
 * @param sessionId - Session UUID
 */
export function getSessionDir(projectPath: string, sessionId: string): string {
	return join(getSessionsDir(projectPath), sessionId)
}

/**
 * Get markers directory within a session.
 * ~/.local/share/navigator/{project-hash}/sessions/{session-id}/markers/
 *
 * @param projectPath - Absolute path to project root
 * @param sessionId - Session UUID
 */
export function getMarkersDir(projectPath: string, sessionId: string): string {
	return join(getSessionDir(projectPath, sessionId), 'markers')
}

// ============================================================================
// File Paths within Session
// ============================================================================

/**
 * Get session metadata file path.
 * ~/.local/share/navigator/{project-hash}/sessions/{session-id}/meta.json
 *
 * @param projectPath - Absolute path to project root
 * @param sessionId - Session UUID
 */
export function getSessionMetaPath(
	projectPath: string,
	sessionId: string,
): string {
	return join(getSessionDir(projectPath, sessionId), 'meta.json')
}

/**
 * Get session steps log file path.
 * ~/.local/share/navigator/{project-hash}/sessions/{session-id}/steps.jsonl
 *
 * @param projectPath - Absolute path to project root
 * @param sessionId - Session UUID
 */
export function getStepsPath(projectPath: string, sessionId: string): string {
	return join(getSessionDir(projectPath, sessionId), 'steps.jsonl')
}

/**
 * Get marker file path.
 * ~/.local/share/navigator/{project-hash}/sessions/{session-id}/markers/{marker-id}.json
 *
 * @param projectPath - Absolute path to project root
 * @param sessionId - Session UUID
 * @param markerId - Marker UUID
 */
export function getMarkerPath(
	projectPath: string,
	sessionId: string,
	markerId: string,
): string {
	return join(getMarkersDir(projectPath, sessionId), `${markerId}.json`)
}

// ============================================================================
// Session Paths Object
// ============================================================================

export interface SessionPaths {
	root: string
	meta: string
	steps: string
	markers: string
}

/**
 * Get all paths for a session.
 *
 * @param projectPath - Absolute path to project root
 * @param sessionId - Session UUID
 */
export function getSessionPaths(
	projectPath: string,
	sessionId: string,
): SessionPaths {
	const root = getSessionDir(projectPath, sessionId)
	return {
		root,
		meta: join(root, 'meta.json'),
		steps: join(root, 'steps.jsonl'),
		markers: join(root, 'markers'),
	}
}
