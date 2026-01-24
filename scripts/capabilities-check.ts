import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ACTION_CATEGORIES } from '../packages/mcp/src/schema.ts'
import { getActionsForSurface } from '../packages/core/src/capabilities/manifest.ts'

const CLI_COMMANDS_DIR = join(
	import.meta.dir,
	'..',
	'packages',
	'cli',
	'src',
	'commands',
)

const ACTION_REGEX = /action:\s*['"]([A-Za-z0-9]+)['"]/g
const ACTION_ENTRY_REGEX = /['"]action['"]\s*,\s*['"]([A-Za-z0-9]+)['"]/g

const strict = process.argv.includes('--strict')

function extractCliActions(): Set<string> {
	const actions = new Set<string>()
	for (const file of readdirSync(CLI_COMMANDS_DIR)) {
		if (!file.endsWith('.ts')) continue
		const contents = readFileSync(join(CLI_COMMANDS_DIR, file), 'utf8')
		for (const match of contents.matchAll(ACTION_REGEX)) {
			actions.add(match[1])
		}
		for (const match of contents.matchAll(ACTION_ENTRY_REGEX)) {
			actions.add(match[1])
		}
	}
	return actions
}

function extractMcpActions(): Set<string> {
	return new Set(Object.values(ACTION_CATEGORIES).flat())
}

function diff(a: Set<string>, b: Set<string>): string[] {
	const result: string[] = []
	for (const value of a) {
		if (!b.has(value)) result.push(value)
	}
	return result.sort()
}

function formatList(values: string[]): string {
	return values.length > 0 ? values.join(', ') : 'none'
}

function report(
	label: string,
	values: string[],
	kind: 'warn' | 'info' = 'warn',
): void {
	const message = `${label}: ${formatList(values)}`
	if (kind === 'warn') {
		console.warn(message)
		return
	}
	console.log(message)
}

const cliActions = extractCliActions()
const mcpActions = extractMcpActions()
const expectedCliActions = new Set(getActionsForSurface('cli'))
const expectedMcpActions = new Set(getActionsForSurface('mcp'))

const cliUnexpected = diff(cliActions, expectedCliActions)
const cliMissing = diff(expectedCliActions, cliActions)
const mcpUnexpected = diff(mcpActions, expectedMcpActions)
const mcpMissing = diff(expectedMcpActions, mcpActions)

console.log('Navigator capabilities check')
console.log(`  CLI actions (actual): ${cliActions.size}`)
console.log(`  MCP actions (actual): ${mcpActions.size}`)
console.log(`  CLI actions (expected): ${expectedCliActions.size}`)
console.log(`  MCP actions (expected): ${expectedMcpActions.size}`)

if (cliUnexpected.length > 0 || mcpUnexpected.length > 0) {
	report('Unexpected CLI actions', cliUnexpected)
	report('Unexpected MCP actions', mcpUnexpected)
} else {
	console.log('  No unexpected capability drift detected.')
}

if (cliMissing.length > 0 || mcpMissing.length > 0) {
	report('Missing CLI actions', cliMissing, 'info')
	report('Missing MCP actions', mcpMissing, 'info')
}

if (
	strict &&
	(cliUnexpected.length > 0 ||
		mcpUnexpected.length > 0 ||
		cliMissing.length > 0 ||
		mcpMissing.length > 0)
) {
	process.exitCode = 1
}
