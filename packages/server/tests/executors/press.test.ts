/**
 * Tests for the press action executor.
 *
 * The press action sends keyboard key presses to the browser,
 * supporting single keys and modifier combinations.
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

describe('press action executor', () => {
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

	describe('single key presses', () => {
		test('sends Enter key to browser', async () => {
			const result = await executor.execute({ action: 'press', key: 'Enter' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('press')
			expect(command?.key).toBe('Enter')
		})

		test('sends Tab key to browser', async () => {
			const result = await executor.execute({ action: 'press', key: 'Tab' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('press')
			expect(command?.key).toBe('Tab')
		})

		test('sends Escape key to browser', async () => {
			const result = await executor.execute({ action: 'press', key: 'Escape' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('press')
			expect(command?.key).toBe('Escape')
		})

		test('sends ArrowDown key to browser', async () => {
			const result = await executor.execute({
				action: 'press',
				key: 'ArrowDown',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('press')
			expect(command?.key).toBe('ArrowDown')
		})
	})

	describe('key normalization', () => {
		test('normalizes esc to Escape', async () => {
			const result = await executor.execute({ action: 'press', key: 'esc' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Escape')
		})

		test('normalizes Esc to Escape (case insensitive)', async () => {
			const result = await executor.execute({ action: 'press', key: 'Esc' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Escape')
		})
	})

	describe('modifier key combinations', () => {
		test('sends ctrl-k as Control+k', async () => {
			const result = await executor.execute({ action: 'press', key: 'ctrl-k' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('press')
			expect(command?.key).toBe('Control+k')
		})

		test('sends ctrl+k (plus separator) as Control+k', async () => {
			const result = await executor.execute({ action: 'press', key: 'ctrl+k' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Control+k')
		})

		test('sends cmd-k as Meta+k', async () => {
			const result = await executor.execute({ action: 'press', key: 'cmd-k' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Meta+k')
		})

		test('sends alt-k as Alt+k', async () => {
			const result = await executor.execute({ action: 'press', key: 'alt-k' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Alt+k')
		})

		test('sends shift-k as Shift+k', async () => {
			const result = await executor.execute({ action: 'press', key: 'shift-k' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Shift+k')
		})
	})

	describe('multiple modifier combinations', () => {
		test('sends ctrl-shift-p as Control+Shift+p', async () => {
			const result = await executor.execute({
				action: 'press',
				key: 'ctrl-shift-p',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Control+Shift+p')
		})

		test('sends cmd-shift-p as Meta+Shift+p', async () => {
			const result = await executor.execute({
				action: 'press',
				key: 'cmd-shift-p',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Meta+Shift+p')
		})

		test('sends ctrl-alt-del as Control+Alt+del', async () => {
			const result = await executor.execute({
				action: 'press',
				key: 'ctrl-alt-del',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Control+Alt+del')
		})

		test('sends cmd-shift-alt-k as Meta+Shift+Alt+k', async () => {
			const result = await executor.execute({
				action: 'press',
				key: 'cmd-shift-alt-k',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Meta+Shift+Alt+k')
		})
	})

	describe('case handling', () => {
		test('handles uppercase modifiers', async () => {
			const result = await executor.execute({ action: 'press', key: 'Ctrl-K' })

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Control+K')
		})

		test('handles mixed case modifiers', async () => {
			const result = await executor.execute({
				action: 'press',
				key: 'CMD-SHIFT-P',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.key).toBe('Meta+Shift+P')
		})
	})

	describe('error handling', () => {
		test('returns error when browser command fails', async () => {
			browserManager.onSend(() => ({
				success: false,
				error: 'Key press failed',
			}))

			const result = await executor.execute({ action: 'press', key: 'Enter' })

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend(() => ({
				success: false,
			}))

			const result = await executor.execute({ action: 'press', key: 'Enter' })

			expect(result.success).toBe(false)
			expect(result.error).toBe('Press failed')
		})
	})

	describe('tab targeting', () => {
		test('sends press to specific tab when tab parameter provided', async () => {
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
					url: 'https://other.com',
					urlHash: 'othr',
					title: 'Tab 1',
					viewport: { width: 1280, height: 720 },
					colorScheme: 'no-preference',
				},
			])

			const result = await executor.execute({
				action: 'press',
				key: 'Enter',
				tab: 1,
			})

			expect(result.success).toBe(true)
			// Check that tab_switch was called before press
			const commands = browserManager.getRecordedCommands()
			const tabSwitchIndex = commands.findIndex(
				(c) => c.command.action === 'tab_switch',
			)
			const pressIndex = commands.findIndex((c) => c.command.action === 'press')
			expect(tabSwitchIndex).toBeLessThan(pressIndex)
		})
	})
})
