/**
 * Update Command
 *
 * Updates Navigator to the latest version.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Command } from 'commander'
import ora from 'ora'
import { bold, cyan, dim, green, yellow } from 'yoctocolors'

// ============================================================================
// Types
// ============================================================================

interface PackageJson {
	name?: string
	version?: string
	workspaces?: string[]
}

interface GitStatusResult {
	isRepo: boolean
	currentBranch: string | null
	hasChanges: boolean
	behind: number
	ahead: number
}

interface SpawnResult {
	exitCode: number
	stdout: string
	stderr: string
}

interface UpdateOptions {
	check?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function runCommand(
	command: string[],
	cwd: string,
	timeout = 60000,
): SpawnResult {
	const result = Bun.spawnSync(command, {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
		timeout,
	})
	return {
		exitCode: result.exitCode ?? 1,
		stdout: result.stdout?.toString() ?? '',
		stderr: result.stderr?.toString() ?? '',
	}
}

/**
 * Find the monorepo root by looking for package.json with workspaces.
 * Starts from the CLI source directory and walks up.
 */
function findRepoRoot(): string | null {
	const cliDir = dirname(fileURLToPath(import.meta.url))
	let current = cliDir

	for (let i = 0; i < 10; i++) {
		const packageJsonPath = join(current, 'package.json')
		if (existsSync(packageJsonPath)) {
			try {
				const content = readFileSync(packageJsonPath, 'utf8')
				const pkg = JSON.parse(content) as PackageJson
				if (pkg.workspaces && Array.isArray(pkg.workspaces)) {
					return current
				}
			} catch {
				// Continue searching
			}
		}
		const parent = dirname(current)
		if (parent === current) {
			break
		}
		current = parent
	}

	return null
}

/**
 * Check if this is a development installation (git repo with workspaces).
 */
function isDevelopmentInstall(): boolean {
	const repoRoot = findRepoRoot()
	return repoRoot !== null && existsSync(join(repoRoot, '.git'))
}

/**
 * Get the current version from the CLI package.json.
 */
function getCurrentVersion(): string {
	try {
		// From packages/cli/src/ go up two levels to packages/cli/package.json
		const packageJsonPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'..',
			'..',
			'package.json',
		)
		const content = readFileSync(packageJsonPath, 'utf8')
		const pkg = JSON.parse(content) as PackageJson
		return pkg.version ?? 'unknown'
	} catch {
		return 'unknown'
	}
}

/**
 * Get git status information.
 */
function getGitStatus(repoRoot: string): GitStatusResult {
	const result: GitStatusResult = {
		isRepo: false,
		currentBranch: null,
		hasChanges: false,
		behind: 0,
		ahead: 0,
	}

	if (!existsSync(join(repoRoot, '.git'))) {
		return result
	}
	result.isRepo = true

	const branchResult = runCommand(
		['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
		repoRoot,
	)
	if (branchResult.exitCode === 0) {
		result.currentBranch = branchResult.stdout.trim()
	}

	const statusResult = runCommand(['git', 'status', '--porcelain'], repoRoot)
	result.hasChanges = statusResult.stdout.trim().length > 0

	runCommand(['git', 'fetch', '--quiet'], repoRoot)

	const revResult = runCommand(
		['git', 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
		repoRoot,
	)
	if (revResult.exitCode === 0) {
		const parts = revResult.stdout.trim().split(/\s+/)
		if (
			parts.length === 2 &&
			parts[0] !== undefined &&
			parts[1] !== undefined
		) {
			result.ahead = Number.parseInt(parts[0], 10) || 0
			result.behind = Number.parseInt(parts[1], 10) || 0
		}
	}

	return result
}

// ============================================================================
// Display Helpers
// ============================================================================

function showProductionUpdateInstructions(): void {
	console.log()
	console.log(yellow('Navigator is not installed in development mode.'))
	console.log()
	console.log('To update Navigator:')
	console.log()
	console.log('  If installed via npm:')
	console.log(dim('    npm update -g @outfitter/navigator-cli'))
	console.log()
	console.log('  If installed via Homebrew:')
	console.log(dim('    brew upgrade outfitter/tap/navigator'))
	console.log()
}

function showGitStatusInfo(gitStatus: GitStatusResult): void {
	console.log(`  Branch: ${gitStatus.currentBranch ?? 'unknown'}`)

	if (gitStatus.hasChanges) {
		console.log(`  Status: ${yellow('uncommitted changes')}`)
	}

	const updatesText =
		gitStatus.behind > 0
			? green(`${gitStatus.behind} commit(s) available`)
			: dim('up to date')
	console.log(`  Updates: ${updatesText}`)
}

// ============================================================================
// Update Steps
// ============================================================================

function runGitPull(repoRoot: string): boolean {
	const spinner = ora('Pulling latest changes...').start()
	const result = runCommand(['git', 'pull', '--ff-only'], repoRoot)

	if (result.exitCode !== 0) {
		spinner.fail('Failed to pull changes')
		console.error(dim(result.stderr || result.stdout))
		return false
	}
	spinner.succeed('Pulled latest changes')
	return true
}

function runBunInstall(repoRoot: string): boolean {
	const spinner = ora('Installing dependencies...').start()
	const result = runCommand(['bun', 'install'], repoRoot, 120000)

	if (result.exitCode !== 0) {
		spinner.fail('Failed to install dependencies')
		console.error(dim(result.stderr || result.stdout))
		return false
	}
	spinner.succeed('Installed dependencies')
	return true
}

function runBunBuild(repoRoot: string): boolean {
	const spinner = ora('Building packages...').start()
	const result = runCommand(['bun', 'run', 'build'], repoRoot, 120000)

	if (result.exitCode !== 0) {
		spinner.fail('Failed to build packages')
		console.error(dim(result.stderr || result.stdout))
		return false
	}
	spinner.succeed('Built packages')
	return true
}

// ============================================================================
// Main Update Logic
// ============================================================================

async function runUpdate(options: UpdateOptions): Promise<void> {
	const { check = false } = options

	console.log()
	console.log(bold('Navigator Update'))
	console.log()

	const currentVersion = getCurrentVersion()
	console.log(`  Current version: ${cyan(currentVersion)}`)

	if (!isDevelopmentInstall()) {
		showProductionUpdateInstructions()
		return
	}

	const repoRoot = findRepoRoot()
	if (!repoRoot) {
		console.error('Error: Could not find repository root.')
		process.exitCode = 1
		return
	}

	console.log(`  Repository: ${dim(repoRoot)}`)

	const gitStatus = getGitStatus(repoRoot)

	if (!gitStatus.isRepo) {
		console.error('Error: Not a git repository.')
		process.exitCode = 1
		return
	}

	showGitStatusInfo(gitStatus)
	console.log()

	if (check) {
		if (gitStatus.behind > 0) {
			console.log(`Run ${cyan('nav update')} to install updates.`)
		}
		console.log()
		return
	}

	if (gitStatus.behind === 0) {
		console.log('Navigator is already up to date.')
		console.log()
		return
	}

	if (gitStatus.hasChanges) {
		console.log(yellow('Warning: You have uncommitted changes.'))
		console.log(dim('Consider committing or stashing before updating.'))
		console.log()
	}

	if (!runGitPull(repoRoot)) {
		process.exitCode = 1
		return
	}

	if (!runBunInstall(repoRoot)) {
		process.exitCode = 1
		return
	}

	if (!runBunBuild(repoRoot)) {
		process.exitCode = 1
		return
	}

	const newVersion = getCurrentVersion()

	console.log()
	if (currentVersion !== newVersion) {
		console.log(`Updated from ${cyan(currentVersion)} to ${green(newVersion)}`)
	} else {
		console.log(green('Navigator updated successfully.'))
	}
	console.log()
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerUpdateCommand(program: Command): void {
	program
		.command('update')
		.description('Update Navigator to latest version')
		.option('-c, --check', 'Check for updates without installing')
		.action(async (options) => {
			await runUpdate(options)
		})
}
