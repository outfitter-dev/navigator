/**
 * Tests for the dialog action executor.
 *
 * The dialog action configures how the browser should handle native dialogs
 * (alert, confirm, prompt). It sets up a handler that will be triggered when
 * the dialog appears.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { ActionExecutor } from '../../src/actions/executor'
import {
	MockBrowserManager,
	MockPairedManager,
	MockSessionManager,
	createDefaultHandler,
	createTestConfig,
} from '../helpers/mock-managers'

describe('dialog action executor', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()
		browserManager.onSend(createDefaultHandler())

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	describe('dialog accept', () => {
		test('sets up dialog accept handler', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('dialog')
			expect(command?.handler).toBe('accept')
		})

		test('accepts alert dialog', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'dialog') {
					expect(cmd.handler).toBe('accept')
					return { success: true }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			expect(result.success).toBe(true)
		})

		test('accepts confirm dialog', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.handler).toBe('accept')
		})
	})

	describe('dialog dismiss', () => {
		test('sets up dialog dismiss handler', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'dismiss',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('dialog')
			expect(command?.handler).toBe('dismiss')
		})

		test('dismisses confirm dialog (clicks Cancel)', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'dialog') {
					expect(cmd.handler).toBe('dismiss')
					return { success: true }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'dialog',
				handler: 'dismiss',
			})

			expect(result.success).toBe(true)
		})

		test('dismisses alert dialog (clicks OK - same as accept for alert)', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'dismiss',
			})

			expect(result.success).toBe(true)
		})
	})

	describe('dialog prompt with text', () => {
		test('sets up prompt handler with text response', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'prompt',
				text: 'user input value',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('dialog')
			expect(command?.handler).toBe('prompt')
			expect(command?.text).toBe('user input value')
		})

		test('handles prompt with empty string', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'prompt',
				text: '',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.text).toBe('')
		})

		test('handles prompt with special characters', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'prompt',
				text: 'Hello, World! @#$%^&*()',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.text).toBe('Hello, World! @#$%^&*()')
		})

		test('handles prompt with multiline text', async () => {
			const multilineText = 'Line 1\nLine 2\nLine 3'
			const result = await executor.execute({
				action: 'dialog',
				handler: 'prompt',
				text: multilineText,
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.text).toBe(multilineText)
		})

		test('handles prompt without text (accepts with default)', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'prompt',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.handler).toBe('prompt')
			// text is optional for prompt handler
		})
	})

	describe('dialog clear', () => {
		test('clears any pending dialog handlers', async () => {
			const result = await executor.execute({
				action: 'dialog',
				handler: 'clear',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('dialog')
			expect(command?.handler).toBe('clear')
		})

		test('clear after accept removes the handler', async () => {
			// First set up accept handler
			await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			// Then clear it
			const result = await executor.execute({
				action: 'dialog',
				handler: 'clear',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.handler).toBe('clear')
		})
	})

	describe('error handling', () => {
		test('returns error when browser command fails', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'dialog') {
					return { success: false, error: 'Failed to set dialog handler' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'dialog') {
					return { success: false }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Dialog setup failed')
		})

		test('returns error for timeout waiting for dialog', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'dialog') {
					return { success: false, error: 'Dialog handler timeout' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})

			expect(result.success).toBe(false)
		})
	})

	describe('tab targeting', () => {
		test('sets dialog handler in specific tab', async () => {
			browserManager.setTabs([
				{
					ref: 0,
					url: 'https://example.com',
					urlHash: 'test',
					title: 'Tab 0',
					viewport: { width: 1280, height: 720 },
					colorScheme: 'no-preference',
				},
				{
					ref: 1,
					url: 'https://dialogs.com',
					urlHash: 'dlgs',
					title: 'Tab 1',
					viewport: { width: 1280, height: 720 },
					colorScheme: 'no-preference',
				},
			])

			const result = await executor.execute({
				action: 'dialog',
				handler: 'accept',
				tab: 1,
			})

			expect(result.success).toBe(true)
			const commands = browserManager.getRecordedCommands()
			const tabSwitchIndex = commands.findIndex(
				(c) => c.command.action === 'tab_switch',
			)
			const dialogIndex = commands.findIndex(
				(c) => c.command.action === 'dialog',
			)
			expect(tabSwitchIndex).toBeLessThan(dialogIndex)
		})
	})

	describe('handler types', () => {
		test('all handler types are valid', async () => {
			const handlers: Array<'accept' | 'dismiss' | 'prompt' | 'clear'> = [
				'accept',
				'dismiss',
				'prompt',
				'clear',
			]

			for (const handler of handlers) {
				browserManager.clearRecordedCommands()
				const result = await executor.execute({
					action: 'dialog',
					handler,
				})

				expect(result.success).toBe(true)
				const command = browserManager.getLastCommand()
				expect(command?.handler).toBe(handler)
			}
		})
	})

	describe('text parameter usage', () => {
		test('text is only sent when provided', async () => {
			// Without text
			await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})
			const commandWithoutText = browserManager.getLastCommand()
			expect(commandWithoutText?.text).toBeUndefined()

			browserManager.clearRecordedCommands()

			// With text
			await executor.execute({
				action: 'dialog',
				handler: 'prompt',
				text: 'some value',
			})
			const commandWithText = browserManager.getLastCommand()
			expect(commandWithText?.text).toBe('some value')
		})

		test('text is preserved for prompt handler even if empty', async () => {
			await executor.execute({
				action: 'dialog',
				handler: 'prompt',
				text: '',
			})

			const command = browserManager.getLastCommand()
			expect(command?.text).toBe('')
		})
	})

	describe('dialog sequence', () => {
		test('can set up multiple dialog handlers in sequence', async () => {
			// Set up accept handler
			const result1 = await executor.execute({
				action: 'dialog',
				handler: 'accept',
			})
			expect(result1.success).toBe(true)

			// Clear it
			const result2 = await executor.execute({
				action: 'dialog',
				handler: 'clear',
			})
			expect(result2.success).toBe(true)

			// Set up dismiss handler
			const result3 = await executor.execute({
				action: 'dialog',
				handler: 'dismiss',
			})
			expect(result3.success).toBe(true)

			// Check sequence of commands
			const commands = browserManager.getRecordedCommands()
			const dialogCommands = commands.filter(
				(c) => c.command.action === 'dialog',
			)
			expect(dialogCommands).toHaveLength(3)
			expect(dialogCommands[0].command.handler).toBe('accept')
			expect(dialogCommands[1].command.handler).toBe('clear')
			expect(dialogCommands[2].command.handler).toBe('dismiss')
		})
	})
})
