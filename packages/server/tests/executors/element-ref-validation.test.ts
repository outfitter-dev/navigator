/**
 * Tests for element ref pre-validation.
 *
 * Element refs must be validated against the last snapshot before
 * being sent to agent-browser. This prevents false success responses
 * when clicking non-existent elements.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { ErrorCode } from '@outfitter/navigator-core'
import { ActionExecutor } from '../../src/actions/executor'
import {
	MockBrowserManager,
	MockPairedManager,
	MockSessionManager,
	createDefaultHandler,
	createTestConfig,
	simulateSnapshot,
} from '../helpers/mock-managers'

describe('element ref validation', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()
		browserManager.onSend(createDefaultHandler({ interactiveCount: 10 }))

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	describe('without snapshot', () => {
		test('click fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
			expect(result.errorCode).toBe(ErrorCode.ELEMENT_NOT_FOUND)
			expect(result.suggestedFix).toContain('snap first')
		})

		test('type fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'type',
				ref: '@e1',
				text: 'hello',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('fill fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'fill',
				ref: '@e1',
				value: 'test',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('hover fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'hover',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('focus fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'focus',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('check fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'check',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('uncheck fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'uncheck',
				ref: '@e1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('upload fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./file.png'],
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('select fails when no snapshot taken', async () => {
			const result = await executor.execute({
				action: 'select',
				ref: '@e1',
				value: 'option1',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('no snapshot taken yet')
		})

		test('CSS selector still works without snapshot', async () => {
			const result = await executor.execute({
				action: 'click',
				selector: '#button',
			})

			expect(result.success).toBe(true)
		})
	})

	describe('with snapshot', () => {
		beforeEach(async () => {
			// Take a snapshot with 10 elements
			await simulateSnapshot(executor)
		})

		test('click succeeds for valid element ref', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: '@e1',
			})

			expect(result.success).toBe(true)
		})

		test('click succeeds for last valid element ref', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: '@e10',
			})

			expect(result.success).toBe(true)
		})

		test('click fails for element ref beyond count', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: '@e11',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('Element @e11 not found')
			expect(result.error).toContain('e1-e10')
			expect(result.errorCode).toBe(ErrorCode.ELEMENT_NOT_FOUND)
			expect(result.suggestedFix).toContain('fresh snap')
		})

		test('click fails for very large element ref', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: '@e99999999',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('Element @e99999999 not found')
		})

		test('click fails for element ref e0 (refs are 1-indexed)', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: '@e0',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('Element @e0 not found')
		})

		test('click succeeds with ref without @ prefix', async () => {
			const result = await executor.execute({
				action: 'click',
				ref: 'e5',
			})

			expect(result.success).toBe(true)
		})

		test('click validates versioned ref correctly', async () => {
			// e5_1 should extract index 5, which is valid for 10 elements
			const result = await executor.execute({
				action: 'click',
				ref: '@e5_1',
			})

			expect(result.success).toBe(true)
		})

		test('type validates element ref', async () => {
			const resultValid = await executor.execute({
				action: 'type',
				ref: '@e5',
				text: 'hello',
			})
			expect(resultValid.success).toBe(true)

			const resultInvalid = await executor.execute({
				action: 'type',
				ref: '@e100',
				text: 'hello',
			})
			expect(resultInvalid.success).toBe(false)
			expect(resultInvalid.error).toContain('Element @e100 not found')
		})

		test('hover validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'hover',
				ref: '@e999',
			})
			expect(resultInvalid.success).toBe(false)
		})

		test('focus validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'focus',
				ref: '@e999',
			})
			expect(resultInvalid.success).toBe(false)
		})

		test('fill validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'fill',
				ref: '@e999',
				value: 'test',
			})
			expect(resultInvalid.success).toBe(false)
		})

		test('select validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'select',
				ref: '@e999',
				value: 'option',
			})
			expect(resultInvalid.success).toBe(false)
		})

		test('check validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'check',
				ref: '@e999',
			})
			expect(resultInvalid.success).toBe(false)
		})

		test('uncheck validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'uncheck',
				ref: '@e999',
			})
			expect(resultInvalid.success).toBe(false)
		})

		test('upload validates element ref', async () => {
			const resultInvalid = await executor.execute({
				action: 'upload',
				ref: '@e999',
				files: ['./file.png'],
			})
			expect(resultInvalid.success).toBe(false)
		})
	})
})
