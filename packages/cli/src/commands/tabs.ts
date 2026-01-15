/**
 * Tab Commands
 *
 * tabs, tab, newTab, closeTab
 */

import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

interface TabInfo {
	ref: string | number
	url: string
	title?: string
	active?: boolean
}

export function registerTabCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	// nav tabs
	program
		.command('tabs')
		.description('List open tabs')
		.action(async () => {
			const client = getClient()
			const result = await client.execute<{ extractedContent?: string }>({
				action: 'tabs',
			})

			// Server returns tabs as JSON in extractedContent
			let tabs: TabInfo[] = []
			if (result.extractedContent) {
				try {
					tabs = JSON.parse(result.extractedContent) as TabInfo[]
				} catch {
					// Ignore parse errors
				}
			}

			if (tabs.length === 0) {
				console.log('No tabs open')
				return
			}

			console.log('Open tabs:')
			for (const tab of tabs) {
				const active = tab.active ? ' *' : ''
				const title = tab.title ? ` - ${tab.title}` : ''
				console.log(`  [${tab.ref}]${active} ${tab.url}${title}`)
			}
		})

	// nav tab <id>
	program
		.command('tab <id>')
		.description('Switch to tab')
		.action(async (id: string) => {
			const client = getClient()

			// Parse as number if it looks like one, otherwise use string
			const ref = /^\d+$/.test(id) ? Number(id) : id

			await client.execute({
				action: 'tab',
				ref,
			})

			console.log('Switched to tab:', id)
		})

	// nav new-tab [url]
	program
		.command('new-tab [url]')
		.description('Open new tab')
		.action(async (url?: string) => {
			const client = getClient()
			const result = await client.execute<{ extractedContent?: string }>({
				action: 'newTab',
				url,
			})

			// Server returns a message like "Created tab 0 at URL" in extractedContent
			console.log(result.extractedContent ?? 'Opened new tab')
		})

	// nav close-tab <id>
	program
		.command('close-tab <id>')
		.description('Close tab')
		.action(async (id: string) => {
			const client = getClient()

			// Parse as number if it looks like one, otherwise use string
			const ref = /^\d+$/.test(id) ? Number(id) : id

			await client.execute({
				action: 'closeTab',
				ref,
			})

			console.log('Closed tab:', id)
		})
}
