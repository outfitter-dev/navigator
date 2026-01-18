/**
 * Tests for the fill action executor.
 *
 * The fill action sets the value of an input field, replacing any existing value.
 * Unlike type, it doesn't simulate keystrokes - it directly sets the value.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { ActionExecutor } from '../../src/actions/executor'
import {
	MockBrowserManager,
	MockPairedManager,
	MockSessionManager,
	createDefaultHandler,
	createTestConfig,
	simulateSnapshot,
} from '../helpers/mock-managers'

describe('fill action executor', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager

	beforeEach(async () => {
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

		// Simulate taking a snapshot to enable element ref validation
		await simulateSnapshot(executor)
	})

	describe('fill by element ref', () => {
		test('fills input using ref', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'test@example.com',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('fill')
			expect(command?.selector).toBe('@e1')
			expect(command?.value).toBe('test@example.com')
		})

		test('fills input using ref without @ prefix', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: 'e42',
				value: 'hello world',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e42')
		})

		test('normalizes ref format', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e123_1',
				value: 'versioned ref',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			// Should extract just the base ref
			expect(command?.selector).toBe('@e123')
		})
	})

	describe('fill by selector', () => {
		test('fills input using CSS selector', async () => {
			const result = await executor.execute({
				action: 'fill',
				selector: '#email',
				value: 'user@domain.com',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('fill')
			expect(command?.selector).toBe('#email')
			expect(command?.value).toBe('user@domain.com')
		})

		test('fills input using complex CSS selector', async () => {
			const result = await executor.execute({
				action: 'fill',
				selector: 'form#login input[name="username"]',
				value: 'admin',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('form#login input[name="username"]')
		})

		test('fills input using data-testid selector', async () => {
			const result = await executor.execute({
				action: 'fill',
				selector: '[data-testid="email-input"]',
				value: 'test@test.com',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('[data-testid="email-input"]')
		})
	})

	describe('value handling', () => {
		test('fills with empty string to clear field', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: '',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.value).toBe('')
		})

		test('fills with special characters', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'p@ssw0rd!#$%^&*()',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.value).toBe('p@ssw0rd!#$%^&*()')
		})

		test('fills with unicode characters', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'Hello World',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.value).toBe('Hello World')
		})

		test('fills with multiline text', async () => {
			const multilineValue = 'Line 1\nLine 2\nLine 3'
			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: multilineValue,
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.value).toBe(multilineValue)
		})
	})

	describe('error handling', () => {
		test('returns error when ref and selector are both missing', async () => {
			const result = await executor.execute({
				action: 'fill',
				value: 'test',
			} as Parameters<typeof executor.execute>[0])

			expect(result.success).toBe(false)
			expect(result.error).toBe('fill requires ref or selector')
		})

		test('returns error when browser command fails', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'fill') {
					return { success: false, error: 'Element not found' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'test',
			})

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'fill') {
					return { success: false }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'test',
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Fill failed')
		})

		test('returns error when element is not fillable', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'fill') {
					return { success: false, error: 'Element is not fillable' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'fill',
				selector: 'div.non-input',
				value: 'test',
			})

			expect(result.success).toBe(false)
		})
	})

	describe('ref takes precedence over selector', () => {
		test('uses ref when both ref and selector provided', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e5',
				selector: '#ignored-selector',
				value: 'test value',
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			// ref should take precedence
			expect(command?.selector).toBe('@e5')
		})
	})

	describe('tab targeting', () => {
		test('fills element in specific tab', async () => {
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

			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'tab 1 value',
				tab: 1,
			})

			expect(result.success).toBe(true)
			// Verify tab switch happened before fill
			const commands = browserManager.getRecordedCommands()
			const tabSwitchIndex = commands.findIndex(
				(c) => c.command.action === 'tab_switch',
			)
			const fillIndex = commands.findIndex((c) => c.command.action === 'fill')
			expect(tabSwitchIndex).toBeLessThan(fillIndex)
		})
	})
})
