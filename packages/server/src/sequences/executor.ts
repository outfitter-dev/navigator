/**
 * Sequence Executor
 *
 * Executes a batch of typed actions with variable interpolation,
 * per-step logging, and configurable error handling.
 */

import type { Action, ActionResult } from '@outfitter/navigator-core'
import { CATEGORIES, getLogger } from '@outfitter/navigator-core/logging'
import {
	MAX_SEQUENCE_DEPTH,
	type SequenceResult,
	type SequenceStepResult,
} from '@outfitter/navigator-core/schema'
import { interpolateParams } from './params'

const log = getLogger(CATEGORIES.ACTIONS)

// ============================================================================
// Types
// ============================================================================

/**
 * Function signature for executing a single action.
 * Matches ActionExecutor.execute() signature.
 */
export type ActionExecuteFn = (
	action: Action,
	projectRoot?: string,
) => Promise<ActionResult>

/**
 * Options for sequence execution.
 *
 * Note: Properties use `| undefined` to support exactOptionalPropertyTypes.
 * This allows callers to pass through values that may be undefined.
 */
export interface SequenceExecuteOptions {
	/** Stop execution on first error (default: true) */
	stopOnError?: boolean | undefined
	/** Optional name for logging */
	name?: string | undefined
	/** Parameters for variable interpolation */
	params?: Record<string, unknown> | undefined
	/** Project root for action execution */
	projectRoot?: string | undefined
	/** Current nesting depth (for recursion guard) */
	depth?: number | undefined
}

// ============================================================================
// Sequence Executor
// ============================================================================

/**
 * Executes a sequence of typed actions with interpolation and logging.
 *
 * Key features:
 * - Variable interpolation via {{varName}} syntax
 * - Per-step execution with individual results
 * - Configurable stopOnError behavior
 * - Recursion guard for nested sequences (max depth: 3)
 */
export class SequenceExecutor {
	constructor(private readonly executeAction: ActionExecuteFn) {}

	/**
	 * Execute a sequence of actions.
	 *
	 * @param steps - Array of actions to execute
	 * @param options - Execution options
	 * @returns Result with per-step details
	 */
	async execute(
		steps: Action[],
		options: SequenceExecuteOptions = {},
	): Promise<SequenceResult> {
		const { stopOnError = true, name, params, projectRoot, depth = 0 } = options

		// Recursion guard
		if (depth >= MAX_SEQUENCE_DEPTH) {
			return this.maxDepthError(steps.length)
		}

		// Empty sequence is a no-op
		if (steps.length === 0) {
			return { success: true, completed: 0, total: 0, steps: [] }
		}

		const seqName = name ?? 'sequence'
		log.info`Executing sequence ${{ name: seqName, stepCount: steps.length }}`

		const results: SequenceStepResult[] = []

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]
			if (!step) {
				// Should never happen with valid array, but satisfies TypeScript
				continue
			}
			const interpolatedStep = params
				? (interpolateParams(step, params) as Action)
				: step

			const stepResult = await this.executeStep(interpolatedStep, i, {
				seqName,
				params,
				projectRoot,
				depth,
				stopOnError,
			})
			results.push(stepResult)

			if (!stepResult.success && stopOnError) {
				return this.stoppedResult(results, i, steps.length, stepResult.error)
			}
		}

		return this.finalResult(results, steps.length)
	}

	/**
	 * Execute a single step and return its result.
	 */
	private async executeStep(
		action: Action,
		index: number,
		context: {
			seqName: string
			params?: Record<string, unknown> | undefined
			projectRoot?: string | undefined
			depth: number
			stopOnError: boolean
		},
	): Promise<SequenceStepResult> {
		const start = Date.now()
		let result: ActionResult

		try {
			if (action.action === 'sequence') {
				result = await this.executeNestedSequence(action, index, context)
			} else {
				result = await this.executeAction(action, context.projectRoot)
			}
		} catch (error) {
			result = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}

		const duration = Date.now() - start
		log.debug`Step executed ${{
			name: context.seqName,
			index,
			action: action.action,
			success: result.success,
			duration,
		}}`

		return {
			index,
			action: action.action,
			success: result.success,
			error: result.error,
			duration,
		}
	}

	/**
	 * Execute a nested sequence action.
	 */
	private async executeNestedSequence(
		action: Action,
		index: number,
		context: {
			seqName: string
			params?: Record<string, unknown> | undefined
			projectRoot?: string | undefined
			depth: number
			stopOnError: boolean
		},
	): Promise<ActionResult> {
		const nested = action as unknown as {
			steps: Action[]
			params?: Record<string, unknown>
		}
		const nestedResult = await this.execute(nested.steps, {
			stopOnError: context.stopOnError,
			name: `${context.seqName}[${index}]`,
			params: { ...context.params, ...nested.params },
			projectRoot: context.projectRoot,
			depth: context.depth + 1,
		})
		return {
			success: nestedResult.success,
			error: nestedResult.error,
			data: nestedResult,
		}
	}

	/**
	 * Create error result for max depth exceeded.
	 */
	private maxDepthError(total: number): SequenceResult {
		return {
			success: false,
			completed: 0,
			total,
			steps: [],
			error: `Maximum sequence nesting depth (${MAX_SEQUENCE_DEPTH}) exceeded`,
		}
	}

	/**
	 * Create result when stopping on error.
	 */
	private stoppedResult(
		results: SequenceStepResult[],
		index: number,
		total: number,
		error?: string,
	): SequenceResult {
		return {
			success: false,
			completed: index + 1,
			total,
			steps: results,
			stoppedAt: index,
			error,
		}
	}

	/**
	 * Create final result after all steps execute.
	 */
	private finalResult(
		results: SequenceStepResult[],
		total: number,
	): SequenceResult {
		const allSuccess = results.every((r) => r.success)
		return {
			success: allSuccess,
			completed: total,
			total,
			steps: results,
			error: allSuccess ? undefined : results.find((r) => !r.success)?.error,
		}
	}
}
