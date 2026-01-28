/**
 * Sequence Schema
 *
 * Defines schemas for batch execution of typed actions.
 * Sequences enable Ami-style efficiency (fewer round trips) while maintaining
 * Navigator's safety guarantees (Zod validation, step logging, debuggability).
 */

import { z } from 'zod'
import { LocatorStrategySchema } from './session'

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Pattern for variable interpolation: {{varName}}
 * Matches variables like {{email}}, {{userName}}, etc.
 */
export const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g

// ============================================================================
// Sequence Step Result
// ============================================================================

/**
 * Result of executing a single step within a sequence.
 * Captures success/failure, timing, and locator info for replay.
 */
export const SequenceStepResultSchema = z.object({
	/** Zero-based index within the sequence */
	index: z.number().int().min(0),
	/** Action type that was executed */
	action: z.string(),
	/** Whether this step succeeded */
	success: z.boolean(),
	/** Error message if step failed */
	error: z.string().optional(),
	/** Execution duration in milliseconds */
	duration: z.number().min(0),
	/** Locator strategy used for element targeting (for replay) */
	locator: LocatorStrategySchema.optional(),
})

export type SequenceStepResult = z.infer<typeof SequenceStepResultSchema>

// ============================================================================
// Sequence Result
// ============================================================================

/**
 * Overall result of sequence execution.
 * Provides summary stats and per-step results for debugging.
 */
export const SequenceResultSchema = z.object({
	/** Whether all steps completed successfully */
	success: z.boolean(),
	/** Number of steps that executed (may be less than total if stopped on error) */
	completed: z.number().int().min(0),
	/** Total number of steps in the sequence */
	total: z.number().int().min(0),
	/** Per-step execution results */
	steps: z.array(SequenceStepResultSchema),
	/** Index where execution stopped (if stopOnError was true and an error occurred) */
	stoppedAt: z.number().int().min(0).optional(),
	/** Error message from the failing step (convenience field) */
	error: z.string().optional(),
})

export type SequenceResult = z.infer<typeof SequenceResultSchema>

// ============================================================================
// Sequence Execution Options
// ============================================================================

/**
 * Options for sequence execution.
 */
export const SequenceOptionsSchema = z.object({
	/** Stop execution on first error (default: true) */
	stopOnError: z.boolean().default(true),
	/** Optional name for logging/debugging */
	name: z.string().optional(),
	/** Parameters for variable interpolation */
	params: z.record(z.unknown()).optional(),
})

export type SequenceOptions = z.infer<typeof SequenceOptionsSchema>

// ============================================================================
// Constants
// ============================================================================

/** Maximum nesting depth for sequences containing other sequences */
export const MAX_SEQUENCE_DEPTH = 3

/**
 * Maximum number of steps allowed in a single sequence.
 * Prevents DoS via extremely long sequences that could lock resources or flood logs.
 */
export const MAX_SEQUENCE_STEPS = 100

// ============================================================================
// Note on Sequence Input Schema
// ============================================================================
// The sequence *action* schema (sequenceAction) that defines the input format:
//   { action: 'sequence', steps: [...], params: {...}, stopOnError: true }
// is defined in action.ts as part of the discriminated union (see T4 in plan).
// This file contains only the *result* schemas for executed sequences.
