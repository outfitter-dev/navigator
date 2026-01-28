/**
 * Sequence Executor Tests
 *
 * Tests for batch action execution with interpolation and error handling.
 */

import { describe, expect, test } from 'bun:test'
import type { Action, ActionResult } from '@outfitter/navigator-core'
import { SequenceExecutor } from '../../src/sequences/executor'

/**
 * Create a mock action executor that records calls and returns configured results.
 */
function createMockExecutor(results: ActionResult[] = []) {
	const calls: { action: Action; projectRoot?: string }[] = []
	let callIndex = 0

	const execute = async (
		action: Action,
		projectRoot?: string,
	): Promise<ActionResult> => {
		calls.push({ action, projectRoot })
		const result = results[callIndex] ?? { success: true }
		callIndex++
		return result
	}

	return { execute, calls }
}

describe('SequenceExecutor', () => {
	describe('execute', () => {
		test('executes empty sequence successfully', async () => {
			const { execute } = createMockExecutor()
			const executor = new SequenceExecutor(execute)

			const result = await executor.execute([])

			expect(result.success).toBe(true)
			expect(result.completed).toBe(0)
			expect(result.total).toBe(0)
			expect(result.steps).toEqual([])
		})

		test('executes single action successfully', async () => {
			const { execute, calls } = createMockExecutor([{ success: true }])
			const executor = new SequenceExecutor(execute)

			const result = await executor.execute([
				{ action: 'navigate', url: 'https://example.com' } as Action,
			])

			expect(result.success).toBe(true)
			expect(result.completed).toBe(1)
			expect(result.total).toBe(1)
			expect(result.steps).toHaveLength(1)
			expect(result.steps[0].success).toBe(true)
			expect(calls).toHaveLength(1)
			expect((calls[0].action as { url: string }).url).toBe(
				'https://example.com',
			)
		})

		test('executes multiple actions in order', async () => {
			const { execute, calls } = createMockExecutor([
				{ success: true },
				{ success: true },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			const steps: Action[] = [
				{ action: 'navigate', url: 'https://example.com' } as Action,
				{ action: 'click', selector: '#btn' } as Action,
				{ action: 'snap' } as Action,
			]

			const result = await executor.execute(steps)

			expect(result.success).toBe(true)
			expect(result.completed).toBe(3)
			expect(calls).toHaveLength(3)
			expect(calls[0].action.action).toBe('navigate')
			expect(calls[1].action.action).toBe('click')
			expect(calls[2].action.action).toBe('snap')
		})

		test('stops on error by default', async () => {
			const { execute, calls } = createMockExecutor([
				{ success: true },
				{ success: false, error: 'Element not found' },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			const steps: Action[] = [
				{ action: 'navigate', url: 'https://example.com' } as Action,
				{ action: 'click', selector: '#missing' } as Action,
				{ action: 'snap' } as Action,
			]

			const result = await executor.execute(steps)

			expect(result.success).toBe(false)
			expect(result.completed).toBe(2)
			expect(result.total).toBe(3)
			expect(result.stoppedAt).toBe(1)
			expect(result.error).toBe('Element not found')
			expect(calls).toHaveLength(2) // Third action not executed
		})

		test('continues on error when stopOnError is false', async () => {
			const { execute, calls } = createMockExecutor([
				{ success: true },
				{ success: false, error: 'Element not found' },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			const steps: Action[] = [
				{ action: 'navigate', url: 'https://example.com' } as Action,
				{ action: 'click', selector: '#missing' } as Action,
				{ action: 'snap' } as Action,
			]

			const result = await executor.execute(steps, { stopOnError: false })

			expect(result.success).toBe(false) // Overall failed due to step 2
			expect(result.completed).toBe(3)
			expect(result.total).toBe(3)
			expect(result.stoppedAt).toBeUndefined()
			expect(calls).toHaveLength(3) // All actions executed
		})

		test('interpolates variables in actions', async () => {
			const { execute, calls } = createMockExecutor([
				{ success: true },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			const steps: Action[] = [
				{ action: 'fill', selector: '#email', value: '{{email}}' } as Action,
				{ action: 'fill', selector: '#name', value: '{{name}}' } as Action,
			]

			await executor.execute(steps, {
				params: { email: 'test@example.com', name: 'John' },
			})

			expect((calls[0].action as { value: string }).value).toBe(
				'test@example.com',
			)
			expect((calls[1].action as { value: string }).value).toBe('John')
		})

		test('passes projectRoot to action executor', async () => {
			const { execute, calls } = createMockExecutor([{ success: true }])
			const executor = new SequenceExecutor(execute)

			await executor.execute(
				[{ action: 'navigate', url: 'https://example.com' } as Action],
				{ projectRoot: '/my/project' },
			)

			expect(calls[0].projectRoot).toBe('/my/project')
		})

		test('tracks duration for each step', async () => {
			const execute = async (): Promise<ActionResult> => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				return { success: true }
			}
			const executor = new SequenceExecutor(execute)

			const result = await executor.execute([
				{ action: 'navigate', url: 'https://example.com' } as Action,
			])

			expect(result.steps[0].duration).toBeGreaterThanOrEqual(10)
		})

		test('handles executor throwing error', async () => {
			const execute = async (): Promise<ActionResult> => {
				throw new Error('Connection lost')
			}
			const executor = new SequenceExecutor(execute)

			const result = await executor.execute([
				{ action: 'navigate', url: 'https://example.com' } as Action,
			])

			expect(result.success).toBe(false)
			expect(result.steps[0].success).toBe(false)
			expect(result.steps[0].error).toBe('Connection lost')
		})

		test('respects max nesting depth', async () => {
			const { execute } = createMockExecutor()
			const executor = new SequenceExecutor(execute)

			// Simulate exceeding depth
			const result = await executor.execute([{ action: 'snap' } as Action], {
				depth: 3,
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('nesting depth')
		})

		test('returns correct step indices', async () => {
			const { execute } = createMockExecutor([
				{ success: true },
				{ success: true },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			const result = await executor.execute([
				{ action: 'navigate', url: 'https://example.com' } as Action,
				{ action: 'click', selector: '#btn' } as Action,
				{ action: 'snap' } as Action,
			])

			expect(result.steps[0].index).toBe(0)
			expect(result.steps[1].index).toBe(1)
			expect(result.steps[2].index).toBe(2)
		})

		test('records action type in step results', async () => {
			const { execute } = createMockExecutor([
				{ success: true },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			const result = await executor.execute([
				{ action: 'navigate', url: 'https://example.com' } as Action,
				{ action: 'click', selector: '#btn' } as Action,
			])

			expect(result.steps[0].action).toBe('navigate')
			expect(result.steps[1].action).toBe('click')
		})

		test('executes nested sequence action', async () => {
			const { execute, calls } = createMockExecutor([
				{ success: true },
				{ success: true },
			])
			const executor = new SequenceExecutor(execute)

			// Create a nested sequence - outer contains inner sequence
			const nestedSequence = {
				action: 'sequence',
				steps: [{ action: 'click', selector: '#inner-btn' } as Action],
			} as unknown as Action

			const result = await executor.execute([
				{ action: 'navigate', url: 'https://example.com' } as Action,
				nestedSequence,
			])

			expect(result.success).toBe(true)
			expect(result.completed).toBe(2)
			expect(result.steps[1].action).toBe('sequence')
			// The inner click should have been executed
			expect(calls.some((c) => c.action.action === 'click')).toBe(true)
		})

		test('merges params in nested sequences', async () => {
			const { execute, calls } = createMockExecutor([{ success: true }])
			const executor = new SequenceExecutor(execute)

			const nestedSequence = {
				action: 'sequence',
				steps: [
					{ action: 'fill', selector: '#field', value: '{{inner}}' } as Action,
				],
				params: { inner: 'nested-value' },
			} as unknown as Action

			await executor.execute([nestedSequence], {
				params: { outer: 'outer-value' },
			})

			// Inner params should override outer
			expect((calls[0].action as { value: string }).value).toBe('nested-value')
		})

		test('stops on nested sequence error when stopOnError is true', async () => {
			const { execute, calls } = createMockExecutor([
				{ success: false, error: 'Nested error' },
			])
			const executor = new SequenceExecutor(execute)

			const nestedSequence = {
				action: 'sequence',
				steps: [{ action: 'click', selector: '#fail' } as Action],
			} as unknown as Action

			const result = await executor.execute([
				nestedSequence,
				{ action: 'snap' } as Action,
			])

			expect(result.success).toBe(false)
			expect(result.stoppedAt).toBe(0)
			expect(calls).toHaveLength(1) // Second action not executed
		})

		test('fails fast on missing required parameters', async () => {
			const { execute, calls } = createMockExecutor([{ success: true }])
			const executor = new SequenceExecutor(execute)

			const steps: Action[] = [
				{ action: 'fill', selector: '#email', value: '{{email}}' } as Action,
				{ action: 'fill', selector: '#name', value: '{{name}}' } as Action,
			]

			const result = await executor.execute(steps, {
				params: { email: 'test@example.com' }, // Missing 'name'
			})

			expect(result.success).toBe(false)
			expect(result.completed).toBe(0)
			expect(result.error).toContain('Missing required parameters')
			expect(result.error).toContain('name')
			expect(calls).toHaveLength(0) // No actions should have executed
		})

		test('rejects sequences exceeding max step count', async () => {
			const { execute, calls } = createMockExecutor([])
			const executor = new SequenceExecutor(execute)

			// Create a sequence with 101 steps (over the limit of 100)
			const steps: Action[] = Array.from({ length: 101 }, (_, i) => ({
				action: 'snap',
			})) as Action[]

			const result = await executor.execute(steps)

			expect(result.success).toBe(false)
			expect(result.completed).toBe(0)
			expect(result.error).toContain('maximum step count')
			expect(calls).toHaveLength(0)
		})
	})
})
