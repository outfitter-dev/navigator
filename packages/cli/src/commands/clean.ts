/**
 * Clean Command
 *
 * Cleans up old Navigator sessions.
 */

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { getNavigatorDataDir } from '@outfitter/navigator-core'
import type { Command } from 'commander'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RETENTION_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

// ============================================================================
// Types
// ============================================================================

interface OldSession {
	projectHash: string
	sessionId: string
	path: string
	modifiedAt: Date
	ageInDays: number
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Prompt user for yes/no confirmation.
 */
async function promptConfirm(message: string): Promise<boolean> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	return new Promise((resolve) => {
		let finished = false

		rl.question(message, (answer) => {
			if (finished) return
			finished = true
			rl.close()
			const normalized = answer.toLowerCase().trim()
			resolve(normalized === 'y' || normalized === 'yes')
		})

		// Handle Ctrl+C
		rl.on('close', () => {
			if (finished) return
			finished = true
			resolve(false)
		})
	})
}

// ============================================================================
// Session Discovery
// ============================================================================

/**
 * Find all sessions older than the retention period.
 */
function findOldSessions(retentionDays: number): OldSession[] {
	const dataDir = getNavigatorDataDir()
	const cutoffTime = Date.now() - retentionDays * MS_PER_DAY
	const oldSessions: OldSession[] = []

	if (!existsSync(dataDir)) {
		return oldSessions
	}

	// Iterate over project hash directories
	const projectDirs = readdirSync(dataDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)

	for (const projectHash of projectDirs) {
		const sessionsDir = join(dataDir, projectHash, 'sessions')
		if (!existsSync(sessionsDir)) {
			continue
		}

		const sessionDirs = readdirSync(sessionsDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)

		for (const sessionId of sessionDirs) {
			const sessionPath = join(sessionsDir, sessionId)

			try {
				const stats = statSync(sessionPath)
				const modifiedAt = stats.mtime

				if (modifiedAt.getTime() < cutoffTime) {
					const ageInDays = Math.floor(
						(Date.now() - modifiedAt.getTime()) / MS_PER_DAY,
					)
					oldSessions.push({
						projectHash,
						sessionId,
						path: sessionPath,
						modifiedAt,
						ageInDays,
					})
				}
			} catch {
				// Skip sessions we can't stat
			}
		}
	}

	// Sort by age (oldest first)
	oldSessions.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

	return oldSessions
}

/**
 * Delete a session directory.
 */
function deleteSession(sessionPath: string): boolean {
	try {
		rmSync(sessionPath, { recursive: true, force: true })
		return true
	} catch {
		return false
	}
}

/**
 * Clean up empty project directories.
 */
function cleanupEmptyProjectDirs(): number {
	const dataDir = getNavigatorDataDir()
	let cleaned = 0

	if (!existsSync(dataDir)) {
		return cleaned
	}

	const projectDirs = readdirSync(dataDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)

	for (const projectHash of projectDirs) {
		const projectDir = join(dataDir, projectHash)
		const sessionsDir = join(projectDir, 'sessions')

		// Check if sessions dir is empty or doesn't exist
		if (existsSync(sessionsDir)) {
			const sessions = readdirSync(sessionsDir)
			if (sessions.length > 0) {
				continue
			}
		}

		// Check if project dir is empty (or only has empty sessions dir)
		const contents = readdirSync(projectDir)
		const hasOnlySessionsDir =
			contents.length === 1 && contents[0] === 'sessions'
		const isEmpty = contents.length === 0

		if (isEmpty || hasOnlySessionsDir) {
			try {
				rmSync(projectDir, { recursive: true, force: true })
				cleaned++
			} catch {
				// Ignore cleanup failures
			}
		}
	}

	return cleaned
}

function parseRetentionDays(value: unknown): number | null {
	const retentionDays = Number(value)
	if (Number.isNaN(retentionDays) || retentionDays < 0) {
		return null
	}
	return retentionDays
}

function logOldSessions(
	oldSessions: OldSession[],
	retentionDays: number,
): void {
	console.log(
		`Found ${oldSessions.length} session(s) older than ${retentionDays} days:\n`,
	)
	for (const session of oldSessions) {
		const shortId = session.sessionId.slice(0, 8)
		console.log(`  ${shortId} (${session.ageInDays} days old)`)
	}
	console.log()
}

async function confirmDeletion(
	count: number,
	skipConfirm: boolean,
): Promise<boolean> {
	if (skipConfirm) return true
	const confirmed = await promptConfirm(`Delete ${count} session(s)? [y/N] `)
	if (!confirmed) {
		console.log('Cancelled.')
		return false
	}
	return true
}

function deleteSessionsAndCount(oldSessions: OldSession[]): {
	deleted: number
	failed: number
} {
	let deleted = 0
	let failed = 0

	for (const session of oldSessions) {
		if (deleteSession(session.path)) {
			deleted++
		} else {
			failed++
		}
	}

	return { deleted, failed }
}

function reportDeletionResults(results: {
	deleted: number
	failed: number
	cleanedDirs: number
}): void {
	if (results.deleted > 0) {
		console.log(`Deleted ${results.deleted} session(s).`)
	}
	if (results.cleanedDirs > 0) {
		console.log(
			`Cleaned up ${results.cleanedDirs} empty project director${results.cleanedDirs === 1 ? 'y' : 'ies'}.`,
		)
	}
	if (results.failed > 0) {
		console.log(`Failed to delete ${results.failed} session(s).`)
		process.exitCode = 1
	}
}

// ============================================================================
// Clean Command
// ============================================================================

export function registerCleanCommand(program: Command): void {
	program
		.command('clean')
		.description('Clean up old Navigator sessions')
		.option(
			'-d, --days <number>',
			'Retention period in days',
			String(DEFAULT_RETENTION_DAYS),
		)
		.option('-y, --yes', 'Skip confirmation prompt')
		.option('--dry-run', 'Show what would be deleted without deleting')
		.action(async (options) => {
			const retentionDays = parseRetentionDays(options.days)
			if (retentionDays === null) {
				console.error('Error: --days must be a non-negative number')
				process.exitCode = 1
				return
			}

			const skipConfirm = options.yes === true
			const dryRun = options.dryRun === true
			const oldSessions = findOldSessions(retentionDays)

			if (oldSessions.length === 0) {
				console.log(`No sessions older than ${retentionDays} days found.`)
				return
			}

			// List what will be deleted
			logOldSessions(oldSessions, retentionDays)

			if (dryRun) {
				console.log('Dry run - no sessions were deleted.')
				return
			}

			// Confirm deletion
			const confirmed = await confirmDeletion(oldSessions.length, skipConfirm)
			if (!confirmed) {
				return
			}

			// Delete sessions
			const { deleted, failed } = deleteSessionsAndCount(oldSessions)

			// Clean up empty project directories
			const cleanedDirs = cleanupEmptyProjectDirs()

			// Report results
			reportDeletionResults({ deleted, failed, cleanedDirs })
		})
}
