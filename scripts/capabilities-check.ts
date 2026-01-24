import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ACTION_CATEGORIES } from '../packages/mcp/src/schema.ts'

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

const EXPECTED_CLI_ONLY = new Set(['markerResolve'])
const EXPECTED_MCP_ONLY = new Set([
	'evaluate',
	'focus',
	'html',
	'markerRead',
	'mode',
	'sessions',
	'text',
	'wait',
	'waitFor',
	'waitForNavigation',
])

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

const cliOnly = diff(cliActions, mcpActions)
const mcpOnly = diff(mcpActions, cliActions)

const unexpectedCliOnly = cliOnly.filter((action) => !EXPECTED_CLI_ONLY.has(action))
const unexpectedMcpOnly = mcpOnly.filter((action) => !EXPECTED_MCP_ONLY.has(action))

const missingExpectedCliOnly = [...EXPECTED_CLI_ONLY].filter(
	(action) => !cliOnly.includes(action),
)
const missingExpectedMcpOnly = [...EXPECTED_MCP_ONLY].filter(
	(action) => !mcpOnly.includes(action),
)

console.log('Navigator capabilities check')
console.log(`  CLI actions: ${cliActions.size}`)
console.log(`  MCP actions: ${mcpActions.size}`)

if (cliOnly.length > 0 || mcpOnly.length > 0) {
	report('CLI-only actions', cliOnly, 'info')
	report('MCP-only actions', mcpOnly, 'info')
}

if (unexpectedCliOnly.length > 0 || unexpectedMcpOnly.length > 0) {
	report('Unexpected CLI-only actions', unexpectedCliOnly)
	report('Unexpected MCP-only actions', unexpectedMcpOnly)
} else {
	console.log('  No unexpected capability drift detected.')
}

if (missingExpectedCliOnly.length > 0 || missingExpectedMcpOnly.length > 0) {
	report(
		'Baseline cleanup (expected CLI-only missing)',
		missingExpectedCliOnly,
		'info',
	)
	report(
		'Baseline cleanup (expected MCP-only missing)',
		missingExpectedMcpOnly,
		'info',
	)
}

if (strict && (unexpectedCliOnly.length > 0 || unexpectedMcpOnly.length > 0)) {
	process.exitCode = 1
}
