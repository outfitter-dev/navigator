import { describe, expect, test } from 'bun:test'
import { ActionSchema } from '../../src/schema/action'

/**
 * Tests for new action schemas defined in cli-cleanup.md
 *
 * These tests will fail until the action schemas are implemented.
 * They define the expected shape of the new actions.
 */

describe('ActionSchema - new actions', () => {
	describe('pressAction', () => {
		test('parses valid press action with single key', () => {
			const result = ActionSchema.safeParse({
				action: 'press',
				key: 'Enter',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid press action with key combo', () => {
			const result = ActionSchema.safeParse({
				action: 'press',
				key: 'ctrl-k',
			})
			expect(result.success).toBe(true)
		})

		test('rejects press action with empty key', () => {
			const result = ActionSchema.safeParse({
				action: 'press',
				key: '',
			})
			expect(result.success).toBe(false)
		})

		test('rejects press action without key', () => {
			const result = ActionSchema.safeParse({
				action: 'press',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('fillAction', () => {
		test('parses valid fill action with ref', () => {
			const result = ActionSchema.safeParse({
				action: 'fill',
				ref: '@e1',
				value: 'test@example.com',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid fill action with selector', () => {
			const result = ActionSchema.safeParse({
				action: 'fill',
				selector: '#email',
				value: 'test@example.com',
			})
			expect(result.success).toBe(true)
		})

		test('parses fill action with empty value', () => {
			const result = ActionSchema.safeParse({
				action: 'fill',
				ref: '@e1',
				value: '',
			})
			expect(result.success).toBe(true)
		})

		test('rejects fill action without value', () => {
			const result = ActionSchema.safeParse({
				action: 'fill',
				ref: '@e1',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('findAction', () => {
		test('parses valid find action with text', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				text: 'Submit',
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with exact match', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				text: 'Submit',
				exact: true,
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with role', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				role: 'button',
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with role and text', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				role: 'button',
				text: 'Submit',
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with label', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				label: 'Email',
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with placeholder', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				placeholder: 'Search...',
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with testid', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				testid: 'submit-btn',
			})
			expect(result.success).toBe(true)
		})

		test('parses find action with ref lookup', () => {
			const result = ActionSchema.safeParse({
				action: 'find',
				ref: '@e42',
			})
			expect(result.success).toBe(true)
		})

		describe('scoped search', () => {
			test('parses find action with inRef scope', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					text: 'Submit',
					inRef: '@e42',
				})
				expect(result.success).toBe(true)
			})

			test('parses find action with inCss scope', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					text: 'Submit',
					inCss: '.modal',
				})
				expect(result.success).toBe(true)
			})

			test('parses find action with inTag scope', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					text: 'Submit',
					inTag: 'form',
				})
				expect(result.success).toBe(true)
			})
		})

		describe('filters', () => {
			test('parses find action with tag filter', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					text: 'Settings',
					tag: 'a',
				})
				expect(result.success).toBe(true)
			})

			test('parses find action with visible filter', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					text: 'Submit',
					visible: true,
				})
				expect(result.success).toBe(true)
			})

			test('parses find action with enabled filter', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					tag: 'input',
					enabled: true,
				})
				expect(result.success).toBe(true)
			})

			test('parses find action with checked filter', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					role: 'checkbox',
					checked: true,
				})
				expect(result.success).toBe(true)
			})

			test('parses find action with combined scope and filters', () => {
				const result = ActionSchema.safeParse({
					action: 'find',
					text: 'Submit',
					inCss: '.modal',
					visible: true,
				})
				expect(result.success).toBe(true)
			})
		})
	})

	describe('checkAction', () => {
		test('parses valid check action with ref', () => {
			const result = ActionSchema.safeParse({
				action: 'check',
				ref: '@e1',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid check action with selector', () => {
			const result = ActionSchema.safeParse({
				action: 'check',
				selector: '#agree',
			})
			expect(result.success).toBe(true)
		})

		test('rejects check action without ref or selector', () => {
			const result = ActionSchema.safeParse({
				action: 'check',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('uncheckAction', () => {
		test('parses valid uncheck action with ref', () => {
			const result = ActionSchema.safeParse({
				action: 'uncheck',
				ref: '@e1',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid uncheck action with selector', () => {
			const result = ActionSchema.safeParse({
				action: 'uncheck',
				selector: '#newsletter',
			})
			expect(result.success).toBe(true)
		})

		test('rejects uncheck action without ref or selector', () => {
			const result = ActionSchema.safeParse({
				action: 'uncheck',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('uploadAction', () => {
		test('parses valid upload action with single file', () => {
			const result = ActionSchema.safeParse({
				action: 'upload',
				ref: '@e1',
				files: ['./file.png'],
			})
			expect(result.success).toBe(true)
		})

		test('parses valid upload action with multiple files', () => {
			const result = ActionSchema.safeParse({
				action: 'upload',
				ref: '@e1',
				files: ['./file1.png', './file2.jpg'],
			})
			expect(result.success).toBe(true)
		})

		test('parses valid upload action with selector', () => {
			const result = ActionSchema.safeParse({
				action: 'upload',
				selector: 'input[type="file"]',
				files: ['./photo.jpg'],
			})
			expect(result.success).toBe(true)
		})

		test('rejects upload action with empty files array', () => {
			const result = ActionSchema.safeParse({
				action: 'upload',
				ref: '@e1',
				files: [],
			})
			expect(result.success).toBe(false)
		})

		test('rejects upload action without files', () => {
			const result = ActionSchema.safeParse({
				action: 'upload',
				ref: '@e1',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('dialogAction', () => {
		test('parses valid dialog accept action', () => {
			const result = ActionSchema.safeParse({
				action: 'dialog',
				handler: 'accept',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid dialog dismiss action', () => {
			const result = ActionSchema.safeParse({
				action: 'dialog',
				handler: 'dismiss',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid dialog prompt action with text', () => {
			const result = ActionSchema.safeParse({
				action: 'dialog',
				handler: 'prompt',
				text: 'answer',
			})
			expect(result.success).toBe(true)
		})

		test('parses valid dialog clear action', () => {
			const result = ActionSchema.safeParse({
				action: 'dialog',
				handler: 'clear',
			})
			expect(result.success).toBe(true)
		})

		test('rejects dialog action without handler', () => {
			const result = ActionSchema.safeParse({
				action: 'dialog',
			})
			expect(result.success).toBe(false)
		})

		test('rejects dialog action with invalid handler', () => {
			const result = ActionSchema.safeParse({
				action: 'dialog',
				handler: 'invalid',
			})
			expect(result.success).toBe(false)
		})
	})
})
