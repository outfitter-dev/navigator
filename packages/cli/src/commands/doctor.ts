/**
 * Doctor Command
 *
 * Checks installation health of the Navigator system.
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getNavigatorConfigDir, loadConfig } from '@outfitter/navigator-core'
import type { Command } from 'commander'

// ============================================================================
// Constants
// ============================================================================

const CHECK_MARK = '\u2713'
const CROSS_MARK = '\u2717'

const PLUGIN_NAME = 'navigator'

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
	name: string
	status: 'ok' | 'warn' | 'error'
	detail: string
}

// ============================================================================
// Checks
// ============================================================================

function checkConfig(): CheckResult {
	const configDir = getNavigatorConfigDir()
	const configPath = join(configDir, 'config.yaml')
	const configPathYml = join(configDir, 'config.yml')

	if (existsSync(configPath)) {
		return {
			name: 'Config',
			status: 'ok',
			detail: configPath,
		}
	}

	if (existsSync(configPathYml)) {
		return {
			name: 'Config',
			status: 'ok',
			detail: configPathYml,
		}
	}

	// Config directory exists but no config file - use defaults
	if (existsSync(configDir)) {
		return {
			name: 'Config',
			status: 'ok',
			detail: 'using defaults',
		}
	}

	// Try loading config to see if defaults work
	try {
		loadConfig()
		return {
			name: 'Config',
			status: 'ok',
			detail: 'using defaults',
		}
	} catch {
		return {
			name: 'Config',
			status: 'warn',
			detail: 'not found (using defaults)',
		}
	}
}

function checkPlugin(): CheckResult {
	const home = homedir()

	// Check global plugin location
	const globalPluginPath = join(home, '.claude', 'plugins', PLUGIN_NAME)
	if (existsSync(globalPluginPath)) {
		return {
			name: 'Plugin',
			status: 'ok',
			detail: 'installed (global)',
		}
	}

	// Check project plugin location
	const projectPluginPath = join(
		process.cwd(),
		'.claude',
		'plugins',
		PLUGIN_NAME,
	)
	if (existsSync(projectPluginPath)) {
		return {
			name: 'Plugin',
			status: 'ok',
			detail: 'installed (project)',
		}
	}

	return {
		name: 'Plugin',
		status: 'warn',
		detail: 'not installed (run: nav install --plugin claude)',
	}
}

function checkExtension(): CheckResult {
	// Extension detection is limited without browser context
	// We can only check if the extension directory exists in common locations
	const home = homedir()

	// Check common Chrome extension directories (macOS)
	const chromeExtensionDirs = [
		join(
			home,
			'Library',
			'Application Support',
			'Google',
			'Chrome',
			'Default',
			'Extensions',
		),
		join(
			home,
			'Library',
			'Application Support',
			'Google',
			'Chrome',
			'Profile 1',
			'Extensions',
		),
	]

	for (const dir of chromeExtensionDirs) {
		if (existsSync(dir)) {
			return {
				name: 'Extension',
				status: 'ok',
				detail: 'Chrome detected (optional)',
			}
		}
	}

	return {
		name: 'Extension',
		status: 'ok',
		detail: 'not detected (optional)',
	}
}

async function checkServer(): Promise<CheckResult> {
	try {
		const config = loadConfig()
		const serverUrl = `http://${config.server.host}:${config.server.port}`
		const response = await fetch(`${serverUrl}/health`, {
			signal: AbortSignal.timeout(2000),
		})

		if (response.ok) {
			const data = (await response.json()) as { status?: string; mode?: string }
			const mode = data.mode ? ` (${data.mode} mode)` : ''
			return {
				name: 'Server',
				status: 'ok',
				detail: `running on :${config.server.port}${mode}`,
			}
		}

		return {
			name: 'Server',
			status: 'error',
			detail: `error (HTTP ${response.status})`,
		}
	} catch (err) {
		if (
			err instanceof Error &&
			(err.message.includes('ECONNREFUSED') ||
				err.message.includes('fetch failed') ||
				err.name === 'TimeoutError')
		) {
			return {
				name: 'Server',
				status: 'warn',
				detail: 'not running',
			}
		}

		return {
			name: 'Server',
			status: 'error',
			detail: err instanceof Error ? err.message : 'unknown error',
		}
	}
}

// ============================================================================
// Doctor Command
// ============================================================================

export function registerDoctorCommand(program: Command): void {
	program
		.command('doctor')
		.description('Check Navigator installation health')
		.action(async () => {
			console.log('Navigator Doctor')

			const results: CheckResult[] = []

			// Run sync checks
			results.push(checkConfig())
			results.push(checkPlugin())
			results.push(checkExtension())

			// Run async checks
			results.push(await checkServer())

			// Display results
			for (const result of results) {
				const symbol = result.status === 'ok' ? CHECK_MARK : CROSS_MARK
				console.log(`  ${result.name}: ${result.detail} ${symbol}`)
			}
		})
}
