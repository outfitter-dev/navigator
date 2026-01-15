/**
 * Uninstall Command
 *
 * Removes Navigator plugin, marketplace, and optionally data.
 */

import { existsSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import {
	getNavigatorConfigDir,
	getNavigatorDataDir,
} from '@outfitter/navigator-core'
import type { Command } from 'commander'
import ora from 'ora'
import { bold, dim, green, yellow } from 'yoctocolors'

// ============================================================================
// Constants
// ============================================================================

const PLUGIN_NAME = 'navigator'
const MARKETPLACE_NAME = 'navigator'
const PLUGIN_REF = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`
const CHECK_MARK = '\u2713'

// ============================================================================
// Types
// ============================================================================

interface SpawnResult {
	exitCode: number
	stdout: string
	stderr: string
}

interface UninstallOptions {
	yes?: boolean
	keepData?: boolean
}

interface UninstallResult {
	pluginUninstalled: boolean
	marketplaceRemoved: boolean
	dataRemoved: boolean
	configRemoved: boolean
	errors: string[]
}

interface PluginStatus {
	global: boolean
	project: boolean
}

interface DataDirInfo {
	exists: boolean
	path: string
	sessionCount: number
}

interface ConfigDirInfo {
	exists: boolean
	path: string
}

// ============================================================================
// Helpers
// ============================================================================

function runCommand(command: string[], cwd: string): SpawnResult {
	const result = Bun.spawnSync(command, {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		exitCode: result.exitCode ?? 1,
		stdout: result.stdout?.toString() ?? '',
		stderr: result.stderr?.toString() ?? '',
	}
}

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

		rl.on('close', () => {
			if (finished) return
			finished = true
			resolve(false)
		})
	})
}

function hasClaudeCli(): boolean {
	return Bun.which('claude') !== null
}

// ============================================================================
// Status Collection
// ============================================================================

function getDataDirInfo(): DataDirInfo {
	const dataDir = getNavigatorDataDir()
	const info: DataDirInfo = { exists: false, path: dataDir, sessionCount: 0 }

	if (!existsSync(dataDir)) {
		return info
	}

	info.exists = true

	try {
		const projectDirs = readdirSync(dataDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)

		for (const projectHash of projectDirs) {
			const sessionsDir = join(dataDir, projectHash, 'sessions')
			if (existsSync(sessionsDir)) {
				const sessions = readdirSync(sessionsDir, {
					withFileTypes: true,
				}).filter((entry) => entry.isDirectory())
				info.sessionCount += sessions.length
			}
		}
	} catch {
		// Ignore errors
	}

	return info
}

function getConfigDirInfo(): ConfigDirInfo {
	const configDir = getNavigatorConfigDir()
	return {
		exists: existsSync(configDir),
		path: configDir,
	}
}

function isPluginInstalled(): PluginStatus {
	const home = homedir()
	const globalPluginPath = join(home, '.claude', 'plugins', PLUGIN_NAME)
	const projectPluginPath = join(
		process.cwd(),
		'.claude',
		'plugins',
		PLUGIN_NAME,
	)

	return {
		global: existsSync(globalPluginPath),
		project: existsSync(projectPluginPath),
	}
}

// ============================================================================
// Display Helpers
// ============================================================================

function displayPluginStatus(pluginStatus: PluginStatus): void {
	if (pluginStatus.global) {
		console.log(`  ${green(CHECK_MARK)} Claude plugin (global)`)
	}
	if (pluginStatus.project) {
		console.log(`  ${green(CHECK_MARK)} Claude plugin (project)`)
	}
	if (!pluginStatus.global && !pluginStatus.project) {
		console.log(`  ${dim('-')} Claude plugin ${dim('(not installed)')}`)
	}
}

function displayDataStatus(
	keepData: boolean,
	dataInfo: DataDirInfo,
	configInfo: ConfigDirInfo,
): void {
	if (keepData) {
		console.log(`  ${dim('-')} Session data ${dim('(--keep-data)')}`)
		console.log(`  ${dim('-')} Config directory ${dim('(--keep-data)')}`)
		return
	}

	if (dataInfo.exists) {
		const sessionText = dataInfo.sessionCount === 1 ? 'session' : 'sessions'
		console.log(
			`  ${green(CHECK_MARK)} Session data ${dim(`(${dataInfo.sessionCount} ${sessionText})`)}`,
		)
		console.log(dim(`      ${dataInfo.path}`))
	}

	if (configInfo.exists) {
		console.log(`  ${green(CHECK_MARK)} Config directory`)
		console.log(dim(`      ${configInfo.path}`))
	}
}

// ============================================================================
// Uninstall Operations
// ============================================================================

function uninstallPlugin(scope: 'user' | 'project'): {
	success: boolean
	error?: string
} {
	const result = runCommand(
		['claude', 'plugin', 'uninstall', PLUGIN_REF, '--scope', scope],
		process.cwd(),
	)

	if (result.exitCode === 0) {
		return { success: true }
	}

	const combined = `${result.stdout}\n${result.stderr}`.toLowerCase()
	if (combined.includes('not installed') || combined.includes('not found')) {
		return { success: true }
	}

	return {
		success: false,
		error: result.stderr.trim() || result.stdout.trim(),
	}
}

function removeMarketplace(): { success: boolean; error?: string } {
	const result = runCommand(
		['claude', 'plugin', 'marketplace', 'remove', MARKETPLACE_NAME],
		process.cwd(),
	)

	if (result.exitCode === 0) {
		return { success: true }
	}

	const combined = `${result.stdout}\n${result.stderr}`.toLowerCase()
	if (combined.includes('not found') || combined.includes('does not exist')) {
		return { success: true }
	}

	return {
		success: false,
		error: result.stderr.trim() || result.stdout.trim(),
	}
}

function removeDirectory(path: string): boolean {
	try {
		rmSync(path, { recursive: true, force: true })
		return true
	} catch {
		return false
	}
}

// ============================================================================
// Uninstall Steps
// ============================================================================

function tryUninstallScopes(pluginStatus: PluginStatus): {
	success: boolean
	errors: string[]
} {
	const results: Array<{
		label: 'Global' | 'Project'
		result: { success: boolean; error?: string }
	}> = []

	if (pluginStatus.global) {
		results.push({ label: 'Global', result: uninstallPlugin('user') })
	}
	if (pluginStatus.project) {
		results.push({ label: 'Project', result: uninstallPlugin('project') })
	}

	// No plugins installed means success
	if (results.length === 0) {
		return { success: true, errors: [] }
	}

	const errors = results
		.filter(({ result }) => !result.success)
		.map(({ label, result }) =>
			result.error ? `${label}: ${result.error}` : `${label}: unknown error`,
		)

	return {
		success: results.some(({ result }) => result.success),
		errors,
	}
}

function uninstallClaudePlugin(
	pluginStatus: PluginStatus,
	result: UninstallResult,
): void {
	const spinner = ora('Uninstalling Claude plugin...').start()
	const uninstallResult = tryUninstallScopes(pluginStatus)

	if (uninstallResult.success) {
		if (uninstallResult.errors.length > 0) {
			spinner.warn('Uninstalled Claude plugin with warnings')
			for (const error of uninstallResult.errors) {
				console.error(dim(`  ${error}`))
				result.errors.push(error)
			}
		} else {
			spinner.succeed('Uninstalled Claude plugin')
		}
		result.pluginUninstalled = true
		return
	}

	spinner.fail('Failed to uninstall plugin')
	if (uninstallResult.errors.length > 0) {
		for (const error of uninstallResult.errors) {
			console.error(dim(`  ${error}`))
			result.errors.push(error)
		}
	} else {
		result.errors.push('Failed to uninstall plugin')
	}
}

function uninstallMarketplace(result: UninstallResult): void {
	const spinner = ora('Removing marketplace entry...').start()
	const marketplaceResult = removeMarketplace()

	if (marketplaceResult.success) {
		spinner.succeed('Removed marketplace entry')
		result.marketplaceRemoved = true
	} else {
		spinner.fail('Failed to remove marketplace')
		if (marketplaceResult.error) {
			console.error(dim(`  ${marketplaceResult.error}`))
			result.errors.push(marketplaceResult.error)
		}
	}
}

function removeSessionData(
	dataInfo: DataDirInfo,
	result: UninstallResult,
): void {
	if (!dataInfo.exists) {
		return
	}

	const spinner = ora('Removing session data...').start()
	if (removeDirectory(dataInfo.path)) {
		spinner.succeed('Removed session data')
		result.dataRemoved = true
	} else {
		spinner.fail('Failed to remove session data')
		result.errors.push(`Could not remove ${dataInfo.path}`)
	}
}

function removeConfigData(
	configInfo: ConfigDirInfo,
	result: UninstallResult,
): void {
	if (!configInfo.exists) {
		return
	}

	const spinner = ora('Removing config directory...').start()
	if (removeDirectory(configInfo.path)) {
		spinner.succeed('Removed config directory')
		result.configRemoved = true
	} else {
		spinner.fail('Failed to remove config directory')
		result.errors.push(`Could not remove ${configInfo.path}`)
	}
}

// ============================================================================
// Main Uninstall Logic
// ============================================================================

async function runUninstall(options: UninstallOptions): Promise<void> {
	const { yes = false, keepData = false } = options

	console.log()
	console.log(bold('Navigator Uninstall'))
	console.log()

	const pluginStatus = isPluginInstalled()
	const dataInfo = getDataDirInfo()
	const configInfo = getConfigDirInfo()
	const hasClaude = hasClaudeCli()

	console.log('The following will be removed:')
	console.log()

	displayPluginStatus(pluginStatus)
	console.log(`  ${green(CHECK_MARK)} Plugin marketplace entry`)
	displayDataStatus(keepData, dataInfo, configInfo)

	console.log()

	const hasAnything =
		pluginStatus.global ||
		pluginStatus.project ||
		hasClaude ||
		(!keepData && (dataInfo.exists || configInfo.exists))

	if (!hasAnything) {
		console.log('Nothing to uninstall.')
		console.log()
		return
	}

	if (!yes) {
		const confirmed = await promptConfirm('Proceed with uninstall? [y/N] ')
		if (!confirmed) {
			console.log('Cancelled.')
			console.log()
			return
		}
		console.log()
	}

	const result: UninstallResult = {
		pluginUninstalled: false,
		marketplaceRemoved: false,
		dataRemoved: false,
		configRemoved: false,
		errors: [],
	}

	if (hasClaude) {
		uninstallClaudePlugin(pluginStatus, result)
		uninstallMarketplace(result)
	} else {
		console.log(yellow('Claude CLI not found - skipping plugin removal.'))
		console.log(dim('  Plugin files may remain in ~/.claude/plugins/'))
	}

	if (!keepData) {
		removeSessionData(dataInfo, result)
		removeConfigData(configInfo, result)
	}

	console.log()

	if (result.errors.length === 0) {
		console.log(green('Navigator uninstalled successfully.'))
	} else {
		console.log(yellow('Navigator uninstalled with some errors.'))
	}

	console.log()
	console.log(dim('To complete removal, also unlink the CLI:'))
	console.log(dim('  cd /path/to/navigator && bun unlink'))
	console.log()
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerUninstallCommand(program: Command): void {
	program
		.command('uninstall')
		.description('Uninstall Navigator plugin and data')
		.option('-y, --yes', 'Skip confirmation prompt')
		.option('--keep-data', 'Keep session data and config')
		.action(async (options) => {
			await runUninstall(options)
		})
}
