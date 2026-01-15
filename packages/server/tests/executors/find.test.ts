/**
 * Tests for the find action executor.
 *
 * The find action searches for elements in the page using various criteria:
 * text, role, label, placeholder, testid, etc. It supports scoping and filtering.
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

describe('find action executor', () => {
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

	describe('find by text', () => {
		test('finds elements containing text', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Submit',
									role: 'button',
									tag: 'button',
									box: { x: 100, y: 200, width: 80, height: 32 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: { type: 'button' },
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				text: 'Submit',
			})

			expect(result.success).toBe(true)
			expect(result.data).toHaveLength(1)
			expect((result.data as Array<{ text: string }>)[0].text).toBe('Submit')
		})

		test('finds elements with exact text match', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					// Parse the args to check exact flag
					const args = cmd.args as Array<{ exact?: boolean }>
					expect(args[0]?.exact).toBe(true)
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				text: 'Submit',
				exact: true,
			})
		})

		test('returns empty array when no elements found', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return { success: true, data: { result: [] } }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				text: 'NonExistent',
			})

			expect(result.success).toBe(true)
			expect(result.data).toEqual([])
			expect(result.extractedContent).toBe('No elements found')
		})
	})

	describe('find by role', () => {
		test('finds elements by ARIA role', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Click me',
									role: 'button',
									tag: 'button',
									box: { x: 0, y: 0, width: 100, height: 40 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
								{
									ref: 'e1',
									text: 'Submit',
									role: 'button',
									tag: 'button',
									box: { x: 120, y: 0, width: 100, height: 40 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				role: 'button',
			})

			expect(result.success).toBe(true)
			expect(result.data).toHaveLength(2)
		})

		test('finds elements by role and text combined', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ role?: string; text?: string }>
					expect(args[0]?.role).toBe('button')
					expect(args[0]?.text).toBe('Submit')
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Submit',
									role: 'button',
									tag: 'button',
									box: { x: 0, y: 0, width: 100, height: 40 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				role: 'button',
				text: 'Submit',
			})

			expect(result.success).toBe(true)
			expect(result.data).toHaveLength(1)
		})
	})

	describe('find by label', () => {
		test('finds form elements by label text', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ label?: string }>
					expect(args[0]?.label).toBe('Email')
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: '',
									role: 'textbox',
									tag: 'input',
									box: { x: 0, y: 0, width: 200, height: 32 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: { type: 'email', id: 'email' },
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				label: 'Email',
			})

			expect(result.success).toBe(true)
			expect(result.data).toHaveLength(1)
		})
	})

	describe('find by testid', () => {
		test('finds elements by data-testid attribute', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ testid?: string }>
					expect(args[0]?.testid).toBe('submit-btn')
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Submit',
									role: 'button',
									tag: 'button',
									box: { x: 0, y: 0, width: 100, height: 40 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: { 'data-testid': 'submit-btn' },
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				testid: 'submit-btn',
			})

			expect(result.success).toBe(true)
		})
	})

	describe('scoped search with inCss', () => {
		test('scopes search to CSS selector container', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ inCss?: string }>
					expect(args[0]?.inCss).toBe('.modal')
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				text: 'Submit',
				inCss: '.modal',
			})
		})
	})

	describe('scoped search with inRef', () => {
		test('scopes search to element ref container', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ inRef?: string }>
					expect(args[0]?.inRef).toBe('@e42')
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				text: 'Confirm',
				inRef: '@e42',
			})
		})
	})

	describe('scoped search with inTag', () => {
		test('scopes search to tag container', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ inTag?: string }>
					expect(args[0]?.inTag).toBe('form')
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				text: 'Submit',
				inTag: 'form',
			})
		})
	})

	describe('filtering with visible', () => {
		test('filters to only visible elements', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ visible?: boolean }>
					expect(args[0]?.visible).toBe(true)
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Visible',
									role: 'div',
									tag: 'div',
									box: { x: 0, y: 0, width: 100, height: 40 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				text: 'Visible',
				visible: true,
			})

			expect(result.success).toBe(true)
			expect(result.data).toHaveLength(1)
		})

		test('filters to only hidden elements', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ visible?: boolean }>
					expect(args[0]?.visible).toBe(false)
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				text: 'Hidden',
				visible: false,
			})
		})
	})

	describe('filtering with enabled', () => {
		test('filters to only enabled elements', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ enabled?: boolean }>
					expect(args[0]?.enabled).toBe(true)
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Enabled Button',
									role: 'button',
									tag: 'button',
									box: { x: 0, y: 0, width: 100, height: 40 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				role: 'button',
				enabled: true,
			})

			expect(result.success).toBe(true)
		})

		test('filters to only disabled elements', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ enabled?: boolean }>
					expect(args[0]?.enabled).toBe(false)
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				role: 'button',
				enabled: false,
			})
		})
	})

	describe('filtering with checked', () => {
		test('filters to checked checkboxes', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ checked?: boolean }>
					expect(args[0]?.checked).toBe(true)
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: '',
									role: 'checkbox',
									tag: 'input',
									box: { x: 0, y: 0, width: 20, height: 20 },
									visible: true,
									enabled: true,
									checked: true,
									attributes: { type: 'checkbox' },
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				role: 'checkbox',
				checked: true,
			})

			expect(result.success).toBe(true)
		})
	})

	describe('multiple results', () => {
		test('returns multiple matching elements', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: 'Option 1',
									role: 'option',
									tag: 'li',
									box: { x: 0, y: 0, width: 100, height: 30 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
								{
									ref: 'e1',
									text: 'Option 2',
									role: 'option',
									tag: 'li',
									box: { x: 0, y: 30, width: 100, height: 30 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
								{
									ref: 'e2',
									text: 'Option 3',
									role: 'option',
									tag: 'li',
									box: { x: 0, y: 60, width: 100, height: 30 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				role: 'option',
			})

			expect(result.success).toBe(true)
			expect(result.data).toHaveLength(3)
			expect(result.extractedContent).toContain('Option 1')
			expect(result.extractedContent).toContain('Option 2')
			expect(result.extractedContent).toContain('Option 3')
		})
	})

	describe('error handling', () => {
		test('returns error when evaluate fails', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return { success: false, error: 'Script execution failed' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				text: 'Submit',
			})

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return { success: false }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				text: 'Submit',
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Find failed')
		})

		test('returns error when result is not an array', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					return { success: true, data: { result: 'not an array' } }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				text: 'Submit',
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Find returned invalid results')
		})
	})

	describe('find by placeholder', () => {
		test('finds elements by placeholder text', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ placeholder?: string }>
					expect(args[0]?.placeholder).toBe('Search...')
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e0',
									text: '',
									role: 'textbox',
									tag: 'input',
									box: { x: 0, y: 0, width: 200, height: 32 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: { placeholder: 'Search...' },
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				placeholder: 'Search...',
			})

			expect(result.success).toBe(true)
		})
	})

	describe('find by ref lookup', () => {
		test('looks up specific element by ref', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ ref?: string }>
					expect(args[0]?.ref).toBe('@e42')
					return {
						success: true,
						data: {
							result: [
								{
									ref: 'e42',
									text: 'The Element',
									role: 'button',
									tag: 'button',
									box: { x: 100, y: 200, width: 80, height: 32 },
									visible: true,
									enabled: true,
									checked: null,
									attributes: {},
								},
							],
						},
					}
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'find',
				ref: '@e42',
			})

			expect(result.success).toBe(true)
		})
	})

	describe('combined scope and filters', () => {
		test('combines inCss scope with visible filter', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'evaluate') {
					const args = cmd.args as Array<{ inCss?: string; visible?: boolean }>
					expect(args[0]?.inCss).toBe('.modal')
					expect(args[0]?.visible).toBe(true)
					return {
						success: true,
						data: { result: [] },
					}
				}
				return createDefaultHandler()(cmd)
			})

			await executor.execute({
				action: 'find',
				text: 'Submit',
				inCss: '.modal',
				visible: true,
			})
		})
	})
})
