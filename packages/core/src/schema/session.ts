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
