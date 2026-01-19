/**
 * Install command for installing Navigator components.
 *
 * Currently supports installing the Claude Code plugin from packages/agents/
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import select from '@inquirer/select'
import ora from 'ora'
import { bold, cyan, dim, green } from 'yoctocolors'

// ============================================================================
// Constants
// ============================================================================

const PLUGIN_NAME = 'navigator'
const MARKETPLACE_NAME = 'navigator'

// ============================================================================
// Types
// ============================================================================

export type InstallScope = 'global' | 'project'

export interface ClaudeConfigStatus {
	configDir: string
	pluginInstalled: boolean
}

export interface RunInstallResult {
	success: boolean
	globalInstalled: boolean
	projectInstalled: boolean
	errors: string[]
}

export interface RunInstallOptions {
	debug?: boolean
}

// ============================================================================
// Paths
// ============================================================================

export function getClaudeConfigDir(): string {
	const defaultPath = join(homedir(), '.claude')
	if (existsSync(defaultPath)) {
		return defaultPath
	}

	if (process.env.XDG_CONFIG_HOME) {
		const xdgPath = join(process.env.XDG_CONFIG_HOME, 'claude')
		if (existsSync(xdgPath)) {
			return xdgPath
		}
	}

	return defaultPath
}

export function detectClaudeConfig(
	scope: InstallScope,
	projectDir: string = process.cwd(),
): ClaudeConfigStatus {
	const configDir =
		scope === 'global' ? getClaudeConfigDir() : join(projectDir, '.claude')
	const pluginsDir = join(configDir, 'plugins')
	const pluginInstalled = existsSync(join(pluginsDir, PLUGIN_NAME))

	return {
		configDir,
		pluginInstalled,
	}
}

/**
 * Discovers the shipped plugin path by checking known locations
 * relative to the CLI package.
 *
 * Checks:
 * 1. Monorepo layout: packages/cli/src/ -> ../../../packages/agents/
 * 2. Standalone layout: dist/ -> ../plugin/
 *
 * @returns Absolute path to the plugin directory, or null if not found
 */
function discoverPluginPath(): string | null {
	const cliDir = dirname(fileURLToPath(import.meta.url))

	// Monorepo layout: packages/cli/src/ -> ../../agents/
	const monorepoPath = resolve(cliDir, '..', '..', 'agents')
	if (existsSync(join(monorepoPath, '.claude-plugin', 'marketplace.json'))) {
		return monorepoPath
	}

	// Standalone layout: dist/ -> ../plugin/
	const standalonePath = resolve(cliDir, '..', 'plugin')
	if (existsSync(join(standalonePath, '.claude-plugin', 'marketplace.json'))) {
		return standalonePath
	}

	return null
}

// ============================================================================
// Install
// ============================================================================

interface InstallPluginOptions {
	debug?: boolean
}

interface SpawnResult {
	exitCode: number
	stdout: string
	stderr: string
}

interface InstallResult {
	success: boolean
	error?: string
	pluginInstalled?: boolean
}

function runClaudeCommand(args: string[], cwd: string): SpawnResult {
	const result = Bun.spawnSync(['claude', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		exitCode: result.exitCode ?? 1,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
	}
}

function logSpawnResult(
	logDebug: (msg: string) => void,
	label: string,
	result: SpawnResult,
): void {
	logDebug(`${label} exit code: ${result.exitCode}`)
	if (result.stdout.trim()) {
		logDebug(`${label} stdout: ${result.stdout.trim()}`)
	}
	if (result.stderr.trim()) {
		logDebug(`${label} stderr: ${result.stderr.trim()}`)
	}
}

function isAlreadyInstalledError(result: SpawnResult): boolean {
	const combined = `${result.stdout}\n${result.stderr}`.toLowerCase()
	return (
		combined.includes('already installed') ||
		combined.includes('already exists')
	)
}

function addMarketplace(
	pluginPath: string,
	projectDir: string,
	debug: boolean,
	logDebug: (msg: string) => void,
): InstallResult | null {
	logDebug(`Adding marketplace at ${pluginPath}`)
	const result = runClaudeCommand(
		['plugin', 'marketplace', 'add', pluginPath],
		projectDir,
	)

	if (result.exitCode === 0) {
		return null // Success, continue
	}

	if (debug) {
		logSpawnResult(logDebug, 'Marketplace add', result)
	}

	if (isAlreadyInstalledError(result)) {
		return null // Already exists, continue
	}

	const errorMsg = debug
		? `${result.stderr}\n${result.stdout}`
		: result.stderr || result.stdout
	return {
		success: false,
		error: `Failed to add marketplace: ${errorMsg.trim()}`,
	}
}

function installPluginFromMarketplace(
	pluginRef: string,
	pluginScope: string,
	projectDir: string,
	debug: boolean,
	logDebug: (msg: string) => void,
): InstallResult {
	logDebug(`Installing plugin ${pluginRef} (scope: ${pluginScope})`)
	const result = runClaudeCommand(
		['plugin', 'install', pluginRef, '--scope', pluginScope],
		projectDir,
	)

	if (result.exitCode === 0) {
		return { success: true, pluginInstalled: true }
	}

	if (debug) {
		logSpawnResult(logDebug, 'Plugin install', result)
	}

	if (result.stderr.includes('already installed')) {
		return { success: true, pluginInstalled: true }
	}

	const errorMsg = debug ? `${result.stderr}\n${result.stdout}` : result.stderr
	return {
		success: false,
		error: `Failed to install plugin: ${errorMsg.trim()}`,
	}
}

function installPlugin(
	scope: InstallScope,
	projectDir: string,
	options: InstallPluginOptions = {},
): InstallResult {
	const { debug = false } = options
	const logDebug = (message: string) => {
		if (debug) {
			console.error(dim(`[debug] ${message}`))
		}
	}

	if (!Bun.which('claude')) {
		return {
			success: false,
			error:
				'Claude CLI not found. Install Claude Code and ensure `claude` is on your PATH.',
		}
	}

	try {
		const pluginPath = discoverPluginPath()
		if (!pluginPath) {
			return {
				success: false,
				error:
					'Could not find shipped plugin. Ensure the Navigator CLI is properly installed.',
			}
		}

		logDebug(`Discovered plugin at: ${pluginPath}`)

		const marketplaceError = addMarketplace(
			pluginPath,
			projectDir,
			debug,
			logDebug,
		)
		if (marketplaceError) {
			return marketplaceError
		}

		const pluginRef = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`
		const pluginScope = scope === 'global' ? 'user' : 'project'
		return installPluginFromMarketplace(
			pluginRef,
			pluginScope,
			projectDir,
			debug,
			logDebug,
		)
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		}
	}
}

// ============================================================================
// Interactive Install Flow
// ============================================================================

const selectTheme = {
	prefix: { idle: green('?'), done: green('✔') },
	icon: { cursor: cyan('\u276F') }, // ❯ in cyan
	style: {
		message: (text: string) => text, // Override Inquirer's default bold
		disabled: (text: string) => dim(text),
		highlight: (text: string) => text, // Pointer indicates selection
		help: (text: string) => dim(`  ${text} • q quit`),
	},
}

async function selectWithQuit<T>(config: {
	message: string
	choices: Array<{ name: string; value: T; disabled?: boolean | string }>
}): Promise<T | null> {
	type CancellablePromise = Promise<T> & { cancel: () => void }
	const stdin = process.stdin
	const wasRaw = stdin.isRaw
	let cancelled = false
	let selectPromise: CancellablePromise | null = null

	const onKeypress = (data: Buffer) => {
		const key = data.toString()
		if (key === 'q' || key === 'Q') {
			cancelled = true
			if (selectPromise) {
				selectPromise.cancel()
			}
		}
	}

	stdin.on('data', onKeypress)

	try {
		selectPromise = select<T>({
			...config,
			theme: selectTheme,
		}) as CancellablePromise
		return await selectPromise
	} catch (err) {
		if (
			cancelled ||
			(err instanceof Error &&
				(err.message.includes('User force closed') ||
					err.name === 'ExitPromptError'))
		) {
			return null
		}
		throw err
	} finally {
		stdin.removeListener('data', onKeypress)
		if (stdin.isRaw !== wasRaw && stdin.isTTY) {
			stdin.setRawMode(wasRaw)
		}
	}
}

function buildChoiceName(
	label: string,
	path: string,
	isInstalled: boolean,
): string {
	const baseName = `${label} ${dim(path)}`
	if (isInstalled) {
		return dim(`${label} ${path} (installed)`)
	}
	return baseName
}

export async function runInstall(
	projectDir: string = process.cwd(),
	options: RunInstallOptions = {},
): Promise<RunInstallResult> {
	const { debug = false } = options
	const result: RunInstallResult = {
		success: true,
		globalInstalled: false,
		projectInstalled: false,
		errors: [],
	}

	console.log()
	console.log(bold('Install Navigator'))
	console.log(dim('Browser automation plugin for Claude Code'))

	const globalStatus = detectClaudeConfig('global', projectDir)
	const projectStatus = detectClaudeConfig('project', projectDir)

	const globalInstalled = globalStatus.pluginInstalled
	const projectInstalled = projectStatus.pluginInstalled

	console.log()

	if (globalInstalled && projectInstalled) {
		console.log('Navigator is already installed in all locations.\n')
		return result
	}

	interface Choice {
		name: string
		value: InstallScope
		disabled: boolean | string
	}

	const choices: Choice[] = [
		{
			name: buildChoiceName(
				'Globally (best)',
				'~/.claude/plugins/navigator',
				globalInstalled,
			),
			value: 'global',
			disabled: globalInstalled,
		},
		{
			name: buildChoiceName(
				'Project',
				'./.claude/plugins/navigator',
				projectInstalled,
			),
			value: 'project',
			disabled: projectInstalled,
		},
	]

	const allDisabled = choices.every((choice) => choice.disabled !== false)
	if (allDisabled) {
		console.log('Navigator is already installed in all locations.\n')
		return result
	}

	const selectedScope = await selectWithQuit<InstallScope>({
		message: 'Install location:',
		choices,
	})

	if (selectedScope === null) {
		console.log('\nInstallation cancelled.\n')
		result.success = false
		return result
	}

	console.log()

	const scopeLabel = selectedScope === 'global' ? 'Global' : 'Project'
	const installSpinner = ora(
		`Installing ${scopeLabel.toLowerCase()}...`,
	).start()

	const installResult = await installPlugin(selectedScope, projectDir, {
		debug,
	})

	if (installResult.success) {
		let msg = `${scopeLabel} installed`
		if (installResult.pluginInstalled) {
			msg += ' + plugin ready'
		}
		installSpinner.succeed(msg)
		if (selectedScope === 'global') {
			result.globalInstalled = true
		} else {
			result.projectInstalled = true
		}
	} else {
		installSpinner.fail(`Failed: ${installResult.error}`)
		result.errors.push(installResult.error ?? 'Unknown error')
		result.success = false
	}

	console.log()

	return result
}
