/**
 * Tests for the check and uncheck action executors.
 *
 * The check action sets a checkbox to checked state (idempotent).
 * The uncheck action sets a checkbox to unchecked state (idempotent).
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

describe('check/uncheck action executors', () => {
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

	describe('check action', () => {
		test('checks checkbox by ref', async () => {
			const result = await executor.execute({
				action: 'check',
				ref: '@e1',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('check')
			expect(command?.selector).toBe('@e1')
		})

		test('checks checkbox by selector', async () => {
			const result = await executor.execute({
				action: 'check',
				selector: '#agree',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('check')
			expect(command?.selector).toBe('#agree')
		})

		test('checks checkbox using data-testid selector', async () => {
			const result = await executor.execute({
				action: 'check',
				selector: '[data-testid="agree-checkbox"]',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('[data-testid="agree-checkbox"]')
		})

		test('check is idempotent - checking already checked checkbox succeeds', async () => {
			// Simulate checkbox already being checked
			browserManager.onSend((cmd) => {
				if (cmd.action === 'check') {
					// Playwright's check is idempotent - it succeeds even if already checked
					return { success: true }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'check',
				ref: '@e1',
			})

			expect(result.success).toBe(true)
		})

		test('returns error when ref and selector are both missing', async () => {
			const result = await executor.execute({
				action: 'check',
			} as Parameters<typeof executor.execute>[0])

			expect(result.success).toBe(false)
			expect(result.error).toBe('check requires ref or selector')
		})

		test('returns error when browser command fails', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'check') {
					return { success: false, error: 'Element not found' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'check',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'check') {
					return { success: false }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'check',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Check failed')
		})

		test('returns error when element is not checkable', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'check') {
					return { success: false, error: 'Element is not a checkbox or radio' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'check',
				selector: 'button#submit',
			})

			expect(result.success).toBe(false)
		})

		test('ref takes precedence over selector', async () => {
			const result = await executor.execute({
				action: 'check',
				ref: '@e5',
				selector: '#ignored',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e5')
		})
	})

	describe('uncheck action', () => {
		test('unchecks checkbox by ref', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e1',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('uncheck')
			expect(command?.selector).toBe('@e1')
		})

		test('unchecks checkbox by selector', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				selector: '#newsletter',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('uncheck')
			expect(command?.selector).toBe('#newsletter')
		})

		test('unchecks checkbox using data-testid selector', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				selector: '[data-testid="newsletter-checkbox"]',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('[data-testid="newsletter-checkbox"]')
		})

		test('uncheck is idempotent - unchecking already unchecked checkbox succeeds', async () => {
			// Simulate checkbox already being unchecked
			browserManager.onSend((cmd) => {
				if (cmd.action === 'uncheck') {
					// Playwright's uncheck is idempotent
					return { success: true }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e1',
			})

			expect(result.success).toBe(true)
		})

		test('returns error when ref and selector are both missing', async () => {
			const result = await executor.execute({
				action: 'uncheck',
			} as Parameters<typeof executor.execute>[0])

			expect(result.success).toBe(false)
			expect(result.error).toBe('uncheck requires ref or selector')
		})

		test('returns error when browser command fails', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'uncheck') {
					return { success: false, error: 'Element not found' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'uncheck') {
					return { success: false }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Uncheck failed')
		})

		test('returns error when element is not uncheckable', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'uncheck') {
					return { success: false, error: 'Element is not a checkbox or radio' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'uncheck',
				selector: 'input[type="text"]',
			})

			expect(result.success).toBe(false)
		})

		test('ref takes precedence over selector', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e10',
				selector: '#ignored-selector',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e10')
		})
	})

	describe('tab targeting', () => {
		beforeEach(() => {
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
					url: 'https://form.com',
					urlHash: 'form',
					title: 'Tab 1',
					viewport: { width: 1280, height: 720 },
					colorScheme: 'no-preference',
				},
			])
		})

		test('check targets specific tab', async () => {
			const result = await executor.execute({
				action: 'check',
				ref: '@e1',
				tab: 1,
			})

			expect(result.success).toBe(true)
			const commands = browserManager.getRecordedCommands()
			const tabSwitchIndex = commands.findIndex(
				(c) => c.command.action === 'tab_switch',
			)
			const checkIndex = commands.findIndex((c) => c.command.action === 'check')
			expect(tabSwitchIndex).toBeLessThan(checkIndex)
		})

		test('uncheck targets specific tab', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e1',
				tab: 1,
			})

			expect(result.success).toBe(true)
			const commands = browserManager.getRecordedCommands()
			const tabSwitchIndex = commands.findIndex(
				(c) => c.command.action === 'tab_switch',
			)
			const uncheckIndex = commands.findIndex(
				(c) => c.command.action === 'uncheck',
			)
			expect(tabSwitchIndex).toBeLessThan(uncheckIndex)
		})
	})

	describe('ref normalization', () => {
		test('check normalizes ref without @ prefix', async () => {
			const result = await executor.execute({
				action: 'check',
				ref: 'e42',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e42')
		})

		test('uncheck normalizes ref without @ prefix', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				ref: 'e42',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e42')
		})

		test('check normalizes versioned ref', async () => {
			const result = await executor.execute({
				action: 'check',
				ref: '@e123_1',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e123')
		})

		test('uncheck normalizes versioned ref', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e123_1',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e123')
		})
	})
})
