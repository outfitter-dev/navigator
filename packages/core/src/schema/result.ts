/**
 * Action Result Schema
 *
 * Defines the result structure for all Navigator actions.
 */

import { z } from 'zod'

// ============================================================================
// Error Code Enum
// ============================================================================

/**
 * Structured error codes for categorizing Navigator errors.
 * Enables programmatic error handling and agent recovery.
 */
export const ErrorCode = {
	/** Element reference not found in DOM (stale snap or invalid ref) */
	ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
	/** Element exists but is not visible in viewport */
	ELEMENT_NOT_VISIBLE: 'ELEMENT_NOT_VISIBLE',
	/** Element is visible but cannot be interacted with */
	ELEMENT_NOT_INTERACTABLE: 'ELEMENT_NOT_INTERACTABLE',
	/** Tab reference does not exist */
	TAB_NOT_FOUND: 'TAB_NOT_FOUND',
	/** Navigation or wait operation timed out */
	NAVIGATION_TIMEOUT: 'NAVIGATION_TIMEOUT',
	/** Invalid selector or element reference format */
	SELECTOR_INVALID: 'SELECTOR_INVALID',
	/** Action is not supported in current mode */
	ACTION_NOT_SUPPORTED: 'ACTION_NOT_SUPPORTED',
	/** Session ID does not exist */
	SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
	/** Paired mode requires extension connection */
	PAIRED_NOT_CONNECTED: 'PAIRED_NOT_CONNECTED',
	/** Element ref points to outdated DOM state */
	STALE_REF: 'STALE_REF',
	/** Multiple elements match when one expected */
	AMBIGUOUS_TARGET: 'AMBIGUOUS_TARGET',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export const ErrorCodeSchema = z.enum([
	'ELEMENT_NOT_FOUND',
	'ELEMENT_NOT_VISIBLE',
	'ELEMENT_NOT_INTERACTABLE',
	'TAB_NOT_FOUND',
	'NAVIGATION_TIMEOUT',
	'SELECTOR_INVALID',
	'ACTION_NOT_SUPPORTED',
	'SESSION_NOT_FOUND',
	'PAIRED_NOT_CONNECTED',
	'STALE_REF',
	'AMBIGUOUS_TARGET',
])

// ============================================================================
// Action Result
// ============================================================================

export const ActionResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
	/** Structured error code for programmatic handling */
	errorCode: ErrorCodeSchema.optional(),
	/** Whether the operation can be retried with a chance of success */
	retryable: z.boolean().optional(),
	/** Suggested fix or next action for the agent */
	suggestedFix: z.string().optional(),
	data: z.unknown().optional(),
	extractedContent: z.string().optional(),
	screenshot: z.string().optional(),
	snapshot: z
		.object({
			version: z.number(),
			timestamp: z.number(),
			url: z.string(),
			title: z.string(),
			tree: z.string(),
			mode: z.string(),
			interactiveCount: z.number(),
		})
		.optional(),
})

export type ActionResult = z.infer<typeof ActionResultSchema>

// ============================================================================
// Tab Info
// ============================================================================

export const ViewportSchema = z.object({
	width: z.number(),
	height: z.number(),
	deviceScaleFactor: z.number().optional(),
})

export type Viewport = z.infer<typeof ViewportSchema>

export const ColorSchemeSchema = z.enum(['light', 'dark', 'no-preference'])

export type ColorScheme = z.infer<typeof ColorSchemeSchema>

export const TabInfoSchema = z.object({
	ref: z.union([z.number(), z.string()]),
	url: z.string(),
	urlHash: z.string(),
	title: z.string(),
	viewport: ViewportSchema,
	colorScheme: ColorSchemeSchema,
})

export type TabInfo = z.infer<typeof TabInfoSchema>
