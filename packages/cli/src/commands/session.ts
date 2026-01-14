/**
 * Session Commands
 *
 * session, steps
 */

import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

interface SessionInfo {
	id: string
	projectPath?: string
	startedAt?: string
	lastActivityAt?: string
	stepCount?: number
}

interface Step {
	id: string
	action: string
	status: 'pending' | 'success' | 'error'
	timestamp?: string
	error?: string
}

export function registerSessionCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	// nav session
	program
		.command('session')
		.description('Show current session')
		.action(async () => {
			const client = getClient()
			const result = await client.execute<{ session: SessionInfo }>({
				action: 'session',
			})

			const session = result.session
			if (!session) {
				console.log('No active session')
				return
			}

			console.log('Current session:')
			console.log(`  ID: ${session.id}`)
			if (session.projectPath) {
				console.log(`  Project: ${session.projectPath}`)
			}
			if (session.startedAt) {
				console.log(`  Started: ${session.startedAt}`)
			}
			if (session.lastActivityAt) {
				console.log(`  Last activity: ${session.lastActivityAt}`)
			}
			if (session.stepCount !== undefined) {
				console.log(`  Steps: ${session.stepCount}`)
			}
		})

	// nav steps
	program
		.command('steps')
		.description('List recent steps')
		.option('-n, --limit <number>', 'Number of steps to show', '20')
		.action(async (options) => {
			const client = getClient()
			const limit = Number(options.limit)

			const result = await client.execute<{ steps: Step[] }>({
				action: 'steps',
				limit,
			})

			const steps = result.steps ?? []
			if (steps.length === 0) {
				console.log('No steps recorded')
				return
			}

			console.log('Recent steps:')
			for (const step of steps) {
				const status = step.status === 'error' ? ' [ERROR]' : ''
				const time = step.timestamp ? ` (${step.timestamp})` : ''
				console.log(`  ${step.id.slice(0, 8)} ${step.action}${status}${time}`)
				if (step.error) {
					console.log(`    Error: ${step.error}`)
				}
			}
		})
}
