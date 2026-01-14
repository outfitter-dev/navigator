/**
 * Action Result Schema
 *
 * Defines the result structure for all Navigator actions.
 */

import { z } from 'zod'

// ============================================================================
// Action Result
// ============================================================================

export const ActionResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
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
