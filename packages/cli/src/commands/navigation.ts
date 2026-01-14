/**
 * Navigation Commands
 *
 * open, back, forward, reload
 */

import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

export function registerNavigationCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	// nav open <url>
	program
		.command('open <url>')
		.description('Navigate to URL')
		.action(async (url: string) => {
			const client = getClient()
			const result = await client.execute<{ url: string }>({
				action: 'navigate',
				url,
			})
			console.log('Navigated to:', result.url)
		})

	// nav back
	program
		.command('back')
		.description('Go back in browser history')
		.action(async () => {
			const client = getClient()
			await client.execute({ action: 'back' })
			console.log('Navigated back')
		})

	// nav forward
	program
		.command('forward')
		.description('Go forward in browser history')
		.action(async () => {
			const client = getClient()
			await client.execute({ action: 'forward' })
			console.log('Navigated forward')
		})

	// nav reload
	program
		.command('reload')
		.description('Reload the current page')
		.action(async () => {
			const client = getClient()
			await client.execute({ action: 'reload' })
			console.log('Page reloaded')
		})
}
