#!/usr/bin/env bun

/**
 * Navigator CLI
 *
 * Browser automation for AI agents.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	CATEGORIES,
	configureLogging,
	getLogger,
} from '@outfitter/navigator-core/logging'
import { Command } from 'commander'
import { type ClientOptions, createClient } from './client.js'
import { registerCleanCommand } from './commands/clean.js'
import { registerDisplayCommands } from './commands/display.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerInteractionCommands } from './commands/interaction.js'
import { registerMarkerCommands } from './commands/markers.js'
import { registerNavigationCommands } from './commands/navigation.js'
import { registerServerCommands } from './commands/server.js'
import { registerSessionCommands } from './commands/session.js'
import { registerTabCommands } from './commands/tabs.js'
import { registerUninstallCommand } from './commands/uninstall.js'
import { registerUpdateCommand } from './commands/update.js'
import { registerWatchCommand } from './commands/watch.js'
import { runInstall } from './install.js'

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
	.option('-d, --debug', 'Enable verbose debug logging')

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

// Display: viewport, color-scheme
registerDisplayCommands(program, getClient)

// Markers: mark save|list|get|diff|remove
registerMarkerCommands(program, getClient)

// Tabs: tab list|switch|new|close
registerTabCommands(program, getClient)

// Session: session, steps
registerSessionCommands(program, getClient)

// Server: server start|status|stop
registerServerCommands(program, getClient)

// Watch: watch
registerWatchCommand(program, getClient)

// Doctor: doctor (no client needed)
registerDoctorCommand(program)

// Clean: clean (no client needed)
registerCleanCommand(program)

// Update: update (no client needed)
registerUpdateCommand(program)

// Uninstall: uninstall (no client needed)
registerUninstallCommand(program)

// ============================================================================
// Special Commands
// ============================================================================

// nav install --plugin <name>
program
	.command('install')
	.description('Install Navigator components')
	.requiredOption('--plugin <name>', 'Plugin to install (claude)')
	.option('--debug', 'Show debug output')
	.action(async (options) => {
		if (options.plugin !== 'claude') {
			console.error(`Unknown plugin: ${options.plugin}`)
			console.error('Available plugins: claude')
			process.exitCode = 1
			return
		}
		const result = await runInstall(process.cwd(), { debug: options.debug })
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

// nav mcp
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
// Logging Setup
// ============================================================================

/**
 * Initialize logging if --debug flag is set.
 * Called before each command via preAction hook.
 */
let loggingInitialized = false
async function initializeLogging(): Promise<void> {
	if (loggingInitialized) return

	const opts = program.opts<{ debug?: boolean }>()
	if (opts.debug) {
		await configureLogging({
			environment: 'development',
			level: 'debug',
		})
		const logger = getLogger(CATEGORIES.CLI)
		logger.debug`CLI debug logging enabled`
	}
	loggingInitialized = true
}

// ============================================================================
// Error Handling
// ============================================================================

program.hook('preAction', async (_thisCommand, actionCommand) => {
	// Skip CLI logging for mcp command - it configures its own logging
	if (actionCommand.name() === 'mcp') return
	await initializeLogging()
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
