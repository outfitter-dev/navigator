#!/usr/bin/env bun

/**
 * Navigator CLI
 *
 * Browser automation for AI agents.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { type ClientOptions, createClient } from './client.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerInteractionCommands } from './commands/interaction.js'
import { registerMarkerCommands } from './commands/markers.js'
import { registerNavigationCommands } from './commands/navigation.js'
import { registerSessionCommands } from './commands/session.js'
import { registerStatusCommand } from './commands/status.js'
import { registerTabCommands } from './commands/tabs.js'
import { registerTidyCommand } from './commands/tidy.js'
import { registerWatchCommand } from './commands/watch.js'
import { runInit } from './init.js'

// ============================================================================
// Version
// ============================================================================

function getVersion(): string {
	try {
		const packageJsonPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'..',
			'package.json',
		)
		const raw = readFileSync(packageJsonPath, 'utf8')
		const parsed = JSON.parse(raw) as { version?: string }
		return parsed.version ?? '0.1.0'
	} catch {
		return '0.1.0'
	}
}

// ============================================================================
// Program Setup
// ============================================================================

const program = new Command()
	.name('nav')
	.description('Browser automation for AI agents')
	.version(getVersion())

// Global options
program
	.option('-s, --session <id>', 'Use specific session')
	.option('-p, --project <path>', 'Project root path')
	.option('--port <number>', 'Server port (default: 9334)')

// ============================================================================
// Client Factory
// ============================================================================

/**
 * Create a client using program options.
 * This is called lazily when commands execute.
 */
function getClient() {
	const opts = program.opts<ClientOptions>()
	return createClient({
		port: opts.port,
		session: opts.session,
		project: opts.project,
	})
}

// ============================================================================
// Register Commands
// ============================================================================

// Navigation: open, back, forward, reload
registerNavigationCommands(program, getClient)

// Interaction: snap, click, type, select, hover, scroll, screenshot
registerInteractionCommands(program, getClient)

// Markers: mark, markers, marker
registerMarkerCommands(program, getClient)

// Tabs: tabs, tab, new-tab, close-tab
registerTabCommands(program, getClient)

// Session: session, steps
registerSessionCommands(program, getClient)

// Status: status
registerStatusCommand(program, getClient)

// Watch: watch
registerWatchCommand(program, getClient)

// Doctor: doctor (no client needed)
registerDoctorCommand(program)

// Tidy: tidy (no client needed)
registerTidyCommand(program)

// ============================================================================
// Special Commands
// ============================================================================

// nav init
program
	.command('init')
	.description('Install Navigator Claude plugin')
	.option('--debug', 'Show debug output')
	.action(async (options) => {
		const result = await runInit(process.cwd(), { debug: options.debug })
		if (!result.success) {
			process.exitCode = 1
		}
	})

// nav action <json>
program
	.command('action <json>')
	.description('Execute raw action JSON')
	.action(async (json: string) => {
		const client = getClient()
		try {
			const action = JSON.parse(json)
			const result = await client.execute(action)
			console.log(JSON.stringify(result, null, 2))
		} catch (err) {
			if (err instanceof SyntaxError) {
				console.error('Invalid JSON:', err.message)
			} else {
				console.error(
					'Error:',
					err instanceof Error ? err.message : String(err),
				)
			}
			process.exitCode = 1
		}
	})

// nav serve - start the navigator server
program
	.command('serve')
	.description('Start Navigator browser server')
	.option('--port <number>', 'Server port (default: 9334)')
	.action(async (options) => {
		const port = options.port ?? process.env.NAVIGATOR_PORT ?? '9334'
		process.env.PORT = port

		// Import server package - auto-starts on import
		try {
			await import('@outfitter/navigator-server')
			// Server is now running, keep process alive
			await new Promise(() => {})
		} catch (err) {
			// Fallback: spawn server from relative path (dev mode)
			const { spawn } = await import('node:child_process')
			const serverPath = join(
				dirname(fileURLToPath(import.meta.url)),
				'..',
				'..',
				'server',
				'src',
				'index.ts',
			)

			console.log(`Starting Navigator server on port ${port}...`)
			const child = spawn('bun', ['run', serverPath], {
				stdio: 'inherit',
				env: { ...process.env, PORT: port },
			})

			child.on('error', (spawnErr) => {
				console.error('Failed to start server:', spawnErr.message)
				process.exitCode = 1
			})

			child.on('exit', (code) => {
				process.exitCode = code ?? 0
			})

			// Forward signals to child
			for (const signal of ['SIGINT', 'SIGTERM'] as const) {
				process.on(signal, () => child.kill(signal))
			}
		}
	})

// nav mcp (placeholder for MCP server start)
program
	.command('mcp')
	.description('Start MCP server')
	.action(async () => {
		// This will be implemented to start the MCP server
		// For now, delegate to the mcp package if available
		try {
			// Dynamic import - may not exist yet
			// @ts-expect-error - MCP package may not be installed
			const mcpModule = (await import('@outfitter/navigator-mcp')) as {
				startServer?: () => Promise<void>
			}
			if (mcpModule.startServer) {
				await mcpModule.startServer()
			} else {
				console.error('MCP server module found but startServer not exported')
				process.exitCode = 1
			}
		} catch (err) {
			console.error(
				'MCP server not available. Install @outfitter/navigator-mcp.',
			)
			if (err instanceof Error && !err.message.includes('Cannot find')) {
				console.error('Error:', err.message)
			}
			process.exitCode = 1
		}
	})

// ============================================================================
// Error Handling
// ============================================================================

program.hook('preAction', () => {
	// Set up error handler for async actions
})

// Handle errors from async actions
process.on('unhandledRejection', (err: unknown) => {
	console.error('Error:', err instanceof Error ? err.message : String(err))
	process.exitCode = 1
})

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse()
