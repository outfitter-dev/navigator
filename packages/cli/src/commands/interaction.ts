/**
 * Interaction Commands
 *
 * snap, click, type, fill, press, select, hover, scroll, screenshot, find, interact
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseKeyCombo } from '@outfitter/navigator-core'
import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

/** Matches element refs like e42 or e42_1 or @e42 */
const ELEMENT_REF_REGEX = /^@?e\d+(?:_\d+)?$/

/** Snap result with optional multi-viewport data */
interface SnapResult {
	tree?: string
	elements?: unknown
	snaps?: Array<{ viewport: string; result: { tree?: string } }>
	data?: {
		snaps?: Array<{ viewport: string; result: { tree?: string } }>
	}
}

/**
 * Output snap result to console, handling multi-viewport and single results.
 */
function outputSnapResult(result: SnapResult): void {
	const snaps = result.data?.snaps ?? result.snaps
	if (snaps && snaps.length > 0) {
		for (const { viewport, result: snapResult } of snaps) {
			console.log(`\n=== Viewport: ${viewport} ===\n`)
			const output = snapResult.tree ?? JSON.stringify(snapResult, null, 2)
			console.log(output)
		}
		return
	}
	if (result.tree) {
		console.log(result.tree)
		return
	}
	console.log(JSON.stringify(result, null, 2))
}

/** Options for the find command */
interface FindOptions {
	role?: string
	label?: string
	testid?: string
	inRef?: string
	inCss?: string
	inTag?: string
	visible?: boolean
}

/**
 * Build payload for find action, filtering undefined values.
 */
function buildFindPayload(
	text: string | undefined,
	options: FindOptions,
): Record<string, unknown> {
	// Build object with only defined values
	const entries: [string, unknown][] = [
		['action', 'find'],
		['text', text],
		['role', options.role],
		['label', options.label],
		['testid', options.testid],
		['inRef', options.inRef],
		['inCss', options.inCss],
		['inTag', options.inTag],
		['visible', options.visible || undefined],
	]
	return Object.fromEntries(entries.filter(([, v]) => v !== undefined))
}

/**
 * Parse a target string into ref or selector.
 */
function parseTarget(value: string): { ref?: string; selector?: string } {
	// Handle ref= prefix
	if (value.startsWith('ref=')) {
		return { ref: value.slice(4) }
	}

	// Handle @ prefix for refs
	if (value.startsWith('@')) {
		return { ref: value.slice(1) }
	}

	// Check if it matches the element ref pattern
	if (ELEMENT_REF_REGEX.test(value)) {
		return { ref: value }
	}

	// Otherwise treat as CSS selector
	return { selector: value }
}

export function registerInteractionCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	// nav snap
	program
		.command('snap')
		.description('Snapshot page with element refs')
		.option('-i, --interactive', 'Interactive elements only')
		.option('-v, --visible', 'Visible elements only (in viewport)')
		.option('-c, --compact', 'Compact output')
		.option('-d, --depth <number>', 'Max depth')
		.option('-s, --selector <selector>', 'Scope to selector')
		.option(
			'--view <viewports>',
			'Capture at viewport(s): mobile, tablet, responsive, etc.',
		)
		.action(async (options) => {
			const client = getClient()
			const result = await client.execute<SnapResult>({
				action: 'snap',
				interactive: options.interactive,
				visibleOnly: options.visible,
				compact: options.compact,
				depth: options.depth ? Number(options.depth) : undefined,
				selector: options.selector,
				view: options.view,
			})
			outputSnapResult(result)
		})

	// nav click <ref|selector>
	program
		.command('click <target>')
		.description('Click element by ref or selector')
		.option('--dbl', 'Double click')
		.action(async (target: string, options) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'click',
				...parsedTarget,
				clickCount: options.dbl ? 2 : 1,
			})
			console.log('Clicked:', target)
		})

	// nav type <ref|selector> <text>
	program
		.command('type <target> <text>')
		.description('Type text into element')
		.option('-c, --clear', 'Clear existing text first')
		.action(async (target: string, text: string, options) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'type',
				...parsedTarget,
				text,
				clear: options.clear,
			})
			console.log('Typed into:', target)
		})

	// nav press <key-combo>
	program
		.command('press <combo>')
		.description(
			'Press keyboard key or combo (e.g., Enter, ctrl-k, cmd-shift-p)',
		)
		.action(async (combo: string) => {
			const client = getClient()
			// Validate and parse the key combo
			const parsed = parseKeyCombo(combo)
			// Build the key string for Playwright (modifiers+key format)
			const keyString =
				parsed.modifiers.length > 0
					? `${parsed.modifiers.join('+')}+${parsed.key}`
					: parsed.key
			await client.execute({
				action: 'press',
				key: keyString,
			})
			console.log('Pressed:', combo)
		})

	// nav fill <ref|selector> <text>
	program
		.command('fill <target> <text>')
		.description('Fill input with text (clears first)')
		.action(async (target: string, text: string) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'fill',
				...parsedTarget,
				value: text,
			})
			console.log('Filled:', target)
		})

	// nav select <ref|selector> <value>
	program
		.command('select <target> <value>')
		.description('Select option in dropdown')
		.action(async (target: string, value: string) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'select',
				...parsedTarget,
				value,
			})
			console.log('Selected:', value, 'in', target)
		})

	// nav hover <ref|selector>
	program
		.command('hover <target>')
		.description('Hover over element')
		.action(async (target: string) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'hover',
				...parsedTarget,
			})
			console.log('Hovering:', target)
		})

	// nav scroll <direction> [amount]
	program
		.command('scroll <direction> [amount]')
		.description('Scroll page (up/down/left/right)')
		.action(async (direction: string, amountStr?: string) => {
			const client = getClient()
			const amount = amountStr ? Number(amountStr) : 100

			let x = 0
			let y = 0

			switch (direction) {
				case 'up':
					y = -amount
					break
				case 'down':
					y = amount
					break
				case 'left':
					x = -amount
					break
				case 'right':
					x = amount
					break
				default:
					console.error('Invalid direction. Use: up, down, left, right')
					process.exit(1)
			}

			await client.execute({
				action: 'scroll',
				x,
				y,
			})
			console.log('Scrolled:', direction, amount)
		})

	// nav screenshot [path]
	program
		.command('screenshot [path]')
		.description('Take screenshot')
		.option('-f, --full', 'Full page screenshot')
		.option('-s, --selector <selector>', 'Capture specific element')
		.option(
			'--view <viewports>',
			'Capture at viewport(s): mobile, tablet, responsive, etc.',
		)
		.action(async (path: string | undefined, options) => {
			const client = getClient()

			const parsedTarget = options.selector ? parseTarget(options.selector) : {}

			const result = await client.execute<{
				screenshot?: string
				screenshots?: Array<{ viewport: string; data: string }>
				data?: {
					screenshots?: Array<{ viewport: string; data: string }>
				}
			}>({
				action: 'screenshot',
				fullPage: options.full,
				...parsedTarget,
				view: options.view,
			})

			// Handle multi-viewport result (server returns data under result.data)
			const screenshots = result.data?.screenshots ?? result.screenshots
			if (screenshots && screenshots.length > 0) {
				const basePath = path ?? 'screenshot'
				for (const { viewport, data } of screenshots) {
					const outputPath = `${basePath.replace(/\.png$/, '')}-${viewport}.png`
					const resolvedPath = resolve(outputPath)
					const buffer = Buffer.from(data, 'base64')
					writeFileSync(resolvedPath, buffer)
					console.log(`Screenshot (${viewport}) saved to:`, resolvedPath)
				}
			} else if (result.screenshot) {
				const outputPath = path ?? 'screenshot.png'
				const resolvedPath = resolve(outputPath)
				const buffer = Buffer.from(result.screenshot, 'base64')
				writeFileSync(resolvedPath, buffer)
				console.log('Screenshot saved to:', resolvedPath)
			} else {
				console.log(JSON.stringify(result, null, 2))
			}
		})

	// nav find [text]
	program
		.command('find [text]')
		.description('Find elements by text, role, label, or test ID')
		.option('-r, --role <role>', 'Find by ARIA role')
		.option('-l, --label <label>', 'Find by accessible label')
		.option('-t, --testid <testid>', 'Find by data-testid')
		.option('--in-ref <ref>', 'Scope search to element ref')
		.option('--in-css <selector>', 'Scope search to CSS selector')
		.option('--in-tag <tag>', 'Scope search to HTML tag')
		.option('-v, --visible', 'Only visible elements')
		.action(async (text: string | undefined, options: FindOptions) => {
			const client = getClient()
			const payload = buildFindPayload(text, options)
			const result = await client.execute<{
				found?: unknown[]
				count?: number
			}>(payload as Parameters<typeof client.execute>[0])
			console.log(JSON.stringify(result, null, 2))
		})

	// nav interact <subcommand>
	const interact = program
		.command('interact')
		.description('Advanced element interactions')

	// nav interact check <ref|selector>
	interact
		.command('check <target>')
		.description('Check a checkbox')
		.action(async (target: string) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'check',
				...parsedTarget,
			})
			console.log('Checked:', target)
		})

	// nav interact uncheck <ref|selector>
	interact
		.command('uncheck <target>')
		.description('Uncheck a checkbox')
		.action(async (target: string) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			await client.execute({
				action: 'uncheck',
				...parsedTarget,
			})
			console.log('Unchecked:', target)
		})

	// nav interact upload <ref|selector> <files...>
	interact
		.command('upload <target> <files...>')
		.description('Upload files to file input')
		.action(async (target: string, files: string[]) => {
			const client = getClient()
			const parsedTarget = parseTarget(target)
			// Resolve file paths to absolute
			const resolvedFiles = files.map((f) => resolve(f))
			await client.execute({
				action: 'upload',
				...parsedTarget,
				files: resolvedFiles,
			})
			console.log('Uploaded to:', target, 'files:', resolvedFiles.join(', '))
		})

	// nav interact dialog <action> [value]
	interact
		.command('dialog <dialogAction> [value]')
		.description('Handle browser dialog (accept, dismiss, prompt, clear)')
		.action(async (dialogAction: string, value?: string) => {
			const client = getClient()

			const validActions = ['accept', 'dismiss', 'prompt', 'clear']
			if (!validActions.includes(dialogAction)) {
				console.error(
					`Invalid dialog action: ${dialogAction}. Use: ${validActions.join(', ')}`,
				)
				process.exitCode = 1
				return
			}

			type DialogHandler = 'accept' | 'dismiss' | 'prompt' | 'clear'

			await client.execute({
				action: 'dialog',
				handler: dialogAction as DialogHandler,
				...(dialogAction === 'prompt' && value ? { text: value } : {}),
			})
			console.log('Dialog:', dialogAction, value ? `with "${value}"` : '')
		})
}
