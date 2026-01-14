/**
 * Session Manager
 *
 * Handles session lifecycle including creation, continuation, and termination.
 * Sessions are browser automation sessions where all artifacts (screenshots,
 * snapshots, markers) are stored together.
 *
 * @module session/manager
 */

import { exec as execCallback } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import {
	SESSION_CONTINUATION_TIMEOUT_MS,
	type SessionMeta,
	SessionMetaSchema,
	type SessionPaths,
	type SessionQuery,
	type SessionSummary,
	getProjectRoot,
	getSessionMetaPath,
	getSessionPaths,
	getSessionsDir,
	getStepsPath,
	hashProjectPath,
} from '@outfitter/navigator-core'

const exec = promisify(execCallback)

// ============================================================================
// Git Utilities
// ============================================================================

interface GitRef {
	sha: string
	branch: string | null
}

/**
 * Get current git reference information.
 *
 * @param projectRoot - Path to the project root
 * @returns Git ref info or null if not a git repo
 */
async function getGitRef(projectRoot: string): Promise<GitRef | null> {
	try {
		const [shaResult, branchResult] = await Promise.all([
			exec('git rev-parse HEAD', { cwd: projectRoot }),
			exec('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot }).catch(
				() => null,
			),
		])

		const sha = shaResult.stdout.trim()

		let branch: string | null = null
		if (branchResult) {
			const branchName = branchResult.stdout.trim()
			if (branchName !== 'HEAD') {
				branch = branchName
			}
		}

		return { sha, branch }
	} catch {
		return null
	}
}

// ============================================================================
// Session Manager
// ============================================================================

/**
 * Manages browser sessions with automatic continuation and cleanup.
 */
export class SessionManager {
	private currentSession: SessionMeta | null = null
	private readonly projectRoot: string
	private readonly projectHash: string

	constructor(projectRoot?: string) {
		this.projectRoot = projectRoot ?? getProjectRoot()
		this.projectHash = hashProjectPath(this.projectRoot)
	}

	/**
	 * Get the current project root.
	 */
	getProjectRoot(): string {
		return this.projectRoot
	}

	/**
	 * Get the project hash.
	 */
	getProjectHash(): string {
		return this.projectHash
	}

	/**
	 * Get the current active session.
	 */
	getCurrentSession(): SessionMeta | null {
		return this.currentSession
	}

	/**
	 * Create a new session or continue an existing one.
	 *
	 * Continuation logic:
	 * - Same project root
	 * - Session not ended
	 * - Last action within 30 minutes
	 *
	 * @param sessionId - Optional specific session ID to use
	 * @returns Session metadata
	 */
	async getOrCreateSession(sessionId?: string): Promise<SessionMeta> {
		// If specific session requested, load it
		if (sessionId) {
			const session = await this.loadSession(sessionId)
			this.currentSession = session
			return session
		}

		// Try to continue the current session
		if (this.currentSession) {
			const canContinue = await this.canContinueSession(this.currentSession.id)
			if (canContinue) {
				return this.currentSession
			}
		}

		// Find an existing continuable session
		const recent = await this.findRecentSession()
		if (recent) {
			this.currentSession = recent
			return recent
		}

		// Create a new session
		return this.createSession()
	}

	/**
	 * Create a new session.
	 */
	async createSession(): Promise<SessionMeta> {
		const id = randomUUID()
		const now = new Date().toISOString()
		const paths = getSessionPaths(this.projectRoot, id)

		// Create session directories
		await mkdir(paths.root, { recursive: true })
		await mkdir(paths.markers, { recursive: true })

		// Capture git info
		const gitRef = await getGitRef(this.projectRoot)

		const meta: SessionMeta = {
			id,
			projectHash: this.projectHash,
			projectPath: this.projectRoot,
			createdAt: now,
			updatedAt: now,
			gitRef: gitRef?.sha,
			gitBranch: gitRef?.branch ?? undefined,
		}

		// Write meta.json
		await writeFile(paths.meta, JSON.stringify(meta, null, 2), 'utf8')

		// Initialize empty steps.jsonl
		await writeFile(paths.steps, '', 'utf8')

		this.currentSession = meta
		return meta
	}

	/**
	 * Load a session by ID.
	 */
	async loadSession(sessionId: string): Promise<SessionMeta> {
		const metaPath = getSessionMetaPath(this.projectRoot, sessionId)
		if (!existsSync(metaPath)) {
			throw new Error(`Session not found: ${sessionId}`)
		}
		const raw = await readFile(metaPath, 'utf8')
		return SessionMetaSchema.parse(JSON.parse(raw))
	}

	/**
	 * Try to load a session, returning null if it doesn't exist.
	 */
	private tryLoadSession(sessionId: string): SessionMeta | null {
		try {
			const metaPath = getSessionMetaPath(this.projectRoot, sessionId)
			if (!existsSync(metaPath)) {
				return null
			}
			const raw = readFileSync(metaPath, 'utf8')
			return SessionMetaSchema.parse(JSON.parse(raw))
		} catch {
			return null
		}
	}

	/**
	 * Touch the session to update its timestamp.
	 */
	async touchSession(): Promise<void> {
		if (!this.currentSession) return

		this.currentSession.updatedAt = new Date().toISOString()
		const metaPath = getSessionMetaPath(
			this.projectRoot,
			this.currentSession.id,
		)
		await writeFile(
			metaPath,
			JSON.stringify(this.currentSession, null, 2),
			'utf8',
		)
	}

	/**
	 * Find the most recent session that can be continued.
	 */
	private async findRecentSession(): Promise<SessionMeta | null> {
		const sessionsDir = getSessionsDir(this.projectRoot)
		if (!existsSync(sessionsDir)) return null

		const sessions = readdirSync(sessionsDir)
			.map((id) => this.tryLoadSession(id))
			.filter((s): s is SessionMeta => s !== null)
			.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			)

		const latest = sessions[0]
		if (!latest) return null

		const canContinue = await this.canContinueSession(latest.id)
		return canContinue ? latest : null
	}

	/**
	 * Check if a session can be continued.
	 */
	private async canContinueSession(sessionId: string): Promise<boolean> {
		const meta = this.tryLoadSession(sessionId)
		if (!meta) return false

		const elapsed = Date.now() - new Date(meta.updatedAt).getTime()
		return elapsed < SESSION_CONTINUATION_TIMEOUT_MS
	}

	/**
	 * List sessions matching query criteria.
	 */
	async listSessions(query: SessionQuery = {}): Promise<SessionSummary[]> {
		const sessionsDir = getSessionsDir(this.projectRoot)
		if (!existsSync(sessionsDir)) return []

		const entries = readdirSync(sessionsDir)
		const sessions: SessionSummary[] = []

		for (const entry of entries) {
			const meta = this.tryLoadSession(entry)
			if (!meta) continue

			// Apply filters
			if (query.projectPath && meta.projectPath !== query.projectPath) {
				continue
			}

			// Count steps
			const stepsPath = getStepsPath(this.projectRoot, meta.id)
			let stepCount = 0
			if (existsSync(stepsPath)) {
				try {
					const content = readFileSync(stepsPath, 'utf8')
					stepCount = content.split('\n').filter((line) => line.trim()).length
				} catch {
					// Ignore read errors
				}
			}

			sessions.push({
				id: meta.id,
				projectHash: meta.projectHash,
				createdAt: meta.createdAt,
				updatedAt: meta.updatedAt,
				stepCount,
				gitBranch: meta.gitBranch,
			})
		}

		// Sort
		const sortOrder = query.sort ?? 'desc'
		sessions.sort((a, b) => {
			const aTime = new Date(a.createdAt).getTime()
			const bTime = new Date(b.createdAt).getTime()
			return sortOrder === 'asc' ? aTime - bTime : bTime - aTime
		})

		// Apply limit
		if (query.limit && query.limit > 0) {
			return sessions.slice(0, query.limit)
		}

		return sessions
	}

	/**
	 * Get session paths for the current session.
	 */
	getSessionPaths(): SessionPaths | null {
		if (!this.currentSession) return null
		return getSessionPaths(this.projectRoot, this.currentSession.id)
	}
}
