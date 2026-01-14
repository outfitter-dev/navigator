/**
 * Init command for installing the Navigator Claude Code plugin.
 */

import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import select from '@inquirer/select'
import ora from 'ora'
import { bold, cyan, dim, green } from 'yoctocolors'

// ============================================================================
// Constants
// ============================================================================

const PLUGIN_NAME = 'navigator'
const PLUGIN_DESCRIPTION = 'Browser automation for AI agents'
const MARKETPLACE_NAME = 'navigator-cli'

const AUTHOR_NAME = 'Matt Galligan'
const AUTHOR_URL = 'https://github.com/galligan'

// ============================================================================
// Types
// ============================================================================

export type InstallScope = 'global' | 'project'

export interface ClaudeConfigStatus {
	configDir: string
	pluginInstalled: boolean
}

export interface InitResult {
	success: boolean
	globalInstalled: boolean
	projectInstalled: boolean
	errors: string[]
}

export interface RunInitOptions {
	debug?: boolean
}

// ============================================================================
// Paths
// ============================================================================

function getPackageRoot(): string {
	const packageJsonPath = fileURLToPath(
		new URL('../package.json', import.meta.url),
	)
	return dirname(packageJsonPath)
}

function getVersion(): string {
	try {
		const packageJsonPath = fileURLToPath(
			new URL('../package.json', import.meta.url),
		)
		const raw = readFileSync(packageJsonPath, 'utf8')
		const parsed = JSON.parse(raw) as { version?: string }
		if (parsed.version) {
			return parsed.version
		}
	} catch {
		// Fall back to default version
	}
	return '0.1.0'
}

function getDataDir(): string {
	if (process.env.XDG_DATA_HOME) {
		return join(process.env.XDG_DATA_HOME, 'navigator')
	}
	if (process.env.HOME) {
		return join(process.env.HOME, '.local', 'share', 'navigator')
	}
	return join(homedir(), '.navigator')
}

function getPluginDir(): string {
	return join(getDataDir(), 'plugin')
}

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

// ============================================================================
// Plugin Files
// ============================================================================

const pluginJson = (version: string): string => `{
  "name": "${PLUGIN_NAME}",
  "version": "${version}",
  "description": "${PLUGIN_DESCRIPTION}",
  "author": {
    "name": "${AUTHOR_NAME}",
    "url": "${AUTHOR_URL}"
  },
  "mcpServers": "../.mcp.json"
}
`

const mcpJson = `{
  "mcpServers": {
    "navigator": {
      "command": "nav",
      "args": ["mcp"]
    }
  }
}
`

const hooksJson = `{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
`

const sessionStartScript = `#!/bin/bash
# navigator SessionStart hook
# Optionally warms the navigator server if available.

NAVIGATOR_SERVER_URL="\${NAVIGATOR_SERVER_URL:-http://localhost:9334}"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "\${NAVIGATOR_SERVER_URL}/health" >/dev/null 2>&1 || true
fi

exit 0
`

const AGENT_FILES: Record<string, string> = {
	'commands/health.md': `---
description: Check navigator server health and mode
allowed-tools: Bash(curl *)
---

# Navigator Health

## Health endpoint
!\`URL=\${NAVIGATOR_SERVER_URL:-http://localhost:9334}; curl -fsSL "\${URL}/health" 2>&1 || echo "Server not reachable at \${URL}"\`
`,
	'commands/session.md': `---
description: Show current navigator session state
allowed-tools: Bash(curl *)
---

# Navigator Session

## Session state
!\`URL=\${NAVIGATOR_SERVER_URL:-http://localhost:9334}; curl -fsSL "\${URL}/session" 2>&1 || echo "Server not reachable at \${URL}"\`
`,
}

function writeFileIfChanged(
	filePath: string,
	content: string,
	mode?: number,
): void {
	if (existsSync(filePath)) {
		const current = readFileSync(filePath, 'utf8')
		if (current === content) {
			if (mode !== undefined) {
				chmodSync(filePath, mode)
			}
			return
		}
	} else {
		mkdirSync(dirname(filePath), { recursive: true })
	}

	writeFileSync(filePath, content)
	if (mode !== undefined) {
		chmodSync(filePath, mode)
	}
}

function resolveAgentContent(relPath: string, fallback: string): string {
	const packageRoot = getPackageRoot()
	const candidates = [
		join(process.cwd(), 'packages', 'agents', relPath),
		join(packageRoot, '..', 'agents', relPath),
	]

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return readFileSync(candidate, 'utf8')
		}
	}

	return fallback
}

function ensureAgentFiles(pluginDir: string): void {
	for (const [relPath, fallback] of Object.entries(AGENT_FILES)) {
		const content = resolveAgentContent(relPath, fallback)
		const targetPath = join(pluginDir, relPath)
		writeFileIfChanged(targetPath, content)
	}
}

function ensurePluginDir(version: string): void {
	const pluginDir = getPluginDir()
	const pluginMetaDir = join(pluginDir, '.claude-plugin')
	const hooksDir = join(pluginDir, 'hooks')
	const scriptsDir = join(pluginDir, 'scripts')

	mkdirSync(pluginMetaDir, { recursive: true })
	mkdirSync(hooksDir, { recursive: true })
	mkdirSync(scriptsDir, { recursive: true })

	writeFileIfChanged(join(pluginMetaDir, 'plugin.json'), pluginJson(version))
	writeFileIfChanged(join(pluginDir, '.mcp.json'), mcpJson)
	writeFileIfChanged(
		join(hooksDir, 'hooks.json'),
		resolveAgentContent('hooks/hooks.json', hooksJson),
	)
	writeFileIfChanged(
		join(scriptsDir, 'session-start.sh'),
		resolveAgentContent('scripts/session-start.sh', sessionStartScript),
		0o755,
	)

	ensureAgentFiles(pluginDir)
}

function marketplaceJson(version: string): string {
	return `{
  "name": "${MARKETPLACE_NAME}",
  "owner": {
    "name": "${AUTHOR_NAME}",
    "email": "noreply@navigator.local"
  },
  "plugins": [
    {
      "name": "${PLUGIN_NAME}",
      "source": "./plugin",
      "description": "${PLUGIN_DESCRIPTION}",
      "version": "${version}",
      "author": {
        "name": "${AUTHOR_NAME}",
        "url": "${AUTHOR_URL}"
      }
    }
  ]
}
`
}

function ensureMarketplace(version: string): { root: string; name: string } {
	const dataDir = getDataDir()
	const marketplaceDir = join(dataDir, '.claude-plugin')
	const marketplacePath = join(marketplaceDir, 'marketplace.json')
	const desired = marketplaceJson(version)

	mkdirSync(marketplaceDir, { recursive: true })

	if (existsSync(marketplacePath)) {
		try {
			const existing = JSON.parse(readFileSync(marketplacePath, 'utf8')) as {
				name?: string
				plugins?: Array<{ name?: string; source?: string }>
			}
			const hasName = existing.name === MARKETPLACE_NAME
			const plugin = Array.isArray(existing.plugins)
				? existing.plugins.find((entry) => entry?.name === PLUGIN_NAME)
				: undefined
			const hasPlugin = Boolean(plugin)
			const hasExpectedSource = plugin?.source === './plugin'
			if (!(hasName && hasPlugin && hasExpectedSource)) {
				writeFileSync(marketplacePath, desired)
			}
		} catch {
			writeFileSync(marketplacePath, desired)
		}
	} else {
		writeFileSync(marketplacePath, desired)
	}

	return { root: dataDir, name: MARKETPLACE_NAME }
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
	marketplace: { root: string },
	projectDir: string,
	debug: boolean,
	logDebug: (msg: string) => void,
): InstallResult | null {
	logDebug(`Adding marketplace at ${marketplace.root}`)
	const result = runClaudeCommand(
		['plugin', 'marketplace', 'add', marketplace.root],
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
		const version = getVersion()
		ensurePluginDir(version)
		const marketplace = ensureMarketplace(version)

		const marketplaceError = addMarketplace(
			marketplace,
			projectDir,
			debug,
			logDebug,
		)
		if (marketplaceError) {
			return marketplaceError
		}

		const pluginRef = `${PLUGIN_NAME}@${marketplace.name}`
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
// Interactive Init Flow
// ============================================================================

const selectTheme = {
	prefix: { idle: green('?'), done: green('?') },
	icon: { cursor: cyan('\u276F') },
	style: {
		disabled: (text: string) => dim(text),
		highlight: (text: string) => text,
		help: (text: string) => dim(`${text} - q quit`),
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

export async function runInit(
	projectDir: string = process.cwd(),
	options: RunInitOptions = {},
): Promise<InitResult> {
	const { debug = false } = options
	const result: InitResult = {
		success: true,
		globalInstalled: false,
		projectInstalled: false,
		errors: [],
	}

	console.log()
	console.log(bold('Install Navigator Claude Plugin'))
	console.log(dim('Adds /navigator commands and SessionStart hook'))

	const globalStatus = detectClaudeConfig('global', projectDir)
	const projectStatus = detectClaudeConfig('project', projectDir)

	const globalInstalled = globalStatus.pluginInstalled
	const projectInstalled = projectStatus.pluginInstalled

	console.log()

	if (globalInstalled && projectInstalled) {
		console.log('Navigator plugin is already installed in all locations.\n')
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
		console.log('Navigator plugin is already installed in all locations.\n')
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
		`Installing ${scopeLabel.toLowerCase()} plugin...`,
	).start()

	const installResult = await installPlugin(selectedScope, projectDir, {
		debug,
	})

	if (installResult.success) {
		installSpinner.succeed(`${scopeLabel} plugin installed`)
		if (selectedScope === 'global') {
			result.globalInstalled = true
		} else {
			result.projectInstalled = true
		}
	} else {
		installSpinner.fail(`Failed to install plugin: ${installResult.error}`)
		result.errors.push(installResult.error ?? 'Unknown error')
		result.success = false
	}

	console.log()

	return result
}
