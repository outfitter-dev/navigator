/**
 * Interaction Commands
 *
 * snap, click, type, select, hover, scroll, screenshot
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

/** Matches element refs like e42 or e42_1 or @e42 */
const ELEMENT_REF_REGEX = /^@?e\d+(?:_\d+)?$/

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
		.option('-c, --compact', 'Compact output')
		.option('-d, --depth <number>', 'Max depth')
		.option('-s, --selector <selector>', 'Scope to selector')
		.action(async (options) => {
			const client = getClient()
			const result = await client.execute<{
				tree?: string
				elements?: unknown
			}>({
				action: 'snap',
				interactive: options.interactive,
				compact: options.compact,
				depth: options.depth ? Number(options.depth) : undefined,
				selector: options.selector,
			})
			if (result.tree) {
				console.log(result.tree)
			} else {
				console.log(JSON.stringify(result, null, 2))
			}
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
		.action(async (path: string | undefined, options) => {
			const client = getClient()

			const parsedTarget = options.selector ? parseTarget(options.selector) : {}

			const result = await client.execute<{ screenshot?: string }>({
				action: 'screenshot',
				fullPage: options.full,
				...parsedTarget,
			})

			if (result.screenshot) {
				const outputPath = path ?? 'screenshot.png'
				const resolvedPath = resolve(outputPath)
				const buffer = Buffer.from(result.screenshot, 'base64')
				writeFileSync(resolvedPath, buffer)
				console.log('Screenshot saved to:', resolvedPath)
			} else {
				console.log(JSON.stringify(result, null, 2))
			}
		})
}
