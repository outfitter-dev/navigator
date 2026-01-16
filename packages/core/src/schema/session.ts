/**
 * Session Schema
 *
 * Defines session metadata and step log entries.
 */

import { z } from 'zod'
import { ActionSchema } from './action'

// ============================================================================
// Session Metadata
// ============================================================================

export const SessionMetaSchema = z.object({
	id: z.string().uuid(),
	projectHash: z.string(),
	projectPath: z.string(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	gitRef: z.string().optional(),
	gitBranch: z.string().optional(),
})

export type SessionMeta = z.infer<typeof SessionMetaSchema>

// ============================================================================
// Locator Strategy Schema
// ============================================================================

/**
 * Locator strategy for replay-friendly element targeting.
 *
 * Captures how to find an element using stable identifiers rather than
 * ephemeral snapshot refs. Strategies are prioritized:
 * 1. testid - Most stable (data-testid attribute)
 * 2. role - ARIA role with accessible name
 * 3. label - Associated label text
 * 4. selector - CSS selector fallback
 */
export const LocatorStrategySchema = z.discriminatedUnion('strategy', [
	z.object({
		strategy: z.literal('role'),
		role: z.string(),
		name: z.string().optional(),
		nth: z.number().optional(),
	}),
	z.object({
		strategy: z.literal('testid'),
		testid: z.string(),
	}),
	z.object({
		strategy: z.literal('selector'),
		selector: z.string(),
	}),
	z.object({
		strategy: z.literal('label'),
		label: z.string(),
	}),
])

export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>

// ============================================================================
// Step Schema
// ============================================================================

export const StepResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
	data: z.unknown().optional(),
})

export type StepResult = z.infer<typeof StepResultSchema>

/**
 * Source of a step/action - distinguishes agent actions from user actions.
 */
export const StepSourceSchema = z.enum(['agent', 'user'])
export type StepSource = z.infer<typeof StepSourceSchema>

export const StepSchema = z.object({
	id: z.string().uuid(),
	timestamp: z.string().datetime(),
	action: ActionSchema,
	result: StepResultSchema,
	duration: z.number(), // ms
	source: StepSourceSchema.optional(),
	locator: LocatorStrategySchema.optional(),
})

export type Step = z.infer<typeof StepSchema>

// ============================================================================
// Session Summary
// ============================================================================

export const SessionSummarySchema = z.object({
	id: z.string().uuid(),
	projectHash: z.string(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	stepCount: z.number(),
	gitBranch: z.string().optional(),
})

export type SessionSummary = z.infer<typeof SessionSummarySchema>

// ============================================================================
// Session Query
// ============================================================================

export interface SessionQuery {
	projectPath?: string | undefined
	activeOnly?: boolean | undefined
	sort?: 'asc' | 'desc' | undefined
	limit?: number | undefined
}

// ============================================================================
// Constants
// ============================================================================

/** Session continuation timeout in milliseconds (30 minutes) */
export const SESSION_CONTINUATION_TIMEOUT_MS = 30 * 60 * 1000
