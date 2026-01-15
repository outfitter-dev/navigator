/**
 * Navigator Action Schema
 *
 * Single-action MCP pattern with action discriminator.
 * Defines all browser automation actions for Navigator.
 */

import { z } from 'zod'

// ============================================================================
// Tab Reference Schema
// ============================================================================

const tabRefSchema = z.union([
	z.number().int().min(0).describe('Live tab index (paired mode)'),
	z
		.string()
		.regex(/^b\d+$/)
		.describe('Headless tab (e.g., "b0", "b1")'),
])

// ============================================================================
// Common Schemas
// ============================================================================

const selectorSchema = z.string().min(1).describe('CSS selector')

// ============================================================================
// Navigation Actions
// ============================================================================

const navigateAction = z.object({
	action: z.literal('navigate'),
	url: z.string().url().describe('URL to navigate to'),
	tab: tabRefSchema
		.optional()
		.describe('Tab to navigate (default: active tab)'),
	waitUntil: z
		.enum(['load', 'domcontentloaded', 'networkidle'])
		.default('networkidle')
		.describe('When to consider navigation complete'),
})

const backAction = z.object({
	action: z.literal('back'),
	tab: tabRefSchema.optional(),
})

const forwardAction = z.object({
	action: z.literal('forward'),
	tab: tabRefSchema.optional(),
})

const reloadAction = z.object({
	action: z.literal('reload'),
	tab: tabRefSchema.optional(),
	hard: z.boolean().default(false).describe('Bypass cache'),
})

// ============================================================================
// Tab Actions
// ============================================================================

const tabAction = z.object({
	action: z.literal('tab'),
	ref: tabRefSchema.describe('Tab to focus'),
})

const tabsAction = z.object({
	action: z.literal('tabs'),
})

const newTabAction = z.object({
	action: z.literal('newTab'),
	url: z.string().url().optional().describe('URL to open in new tab'),
})

const closeTabAction = z.object({
	action: z.literal('closeTab'),
	ref: tabRefSchema.describe('Tab to close'),
})

// ============================================================================
// Interaction Actions
// ============================================================================

const clickAction = z.object({
	action: z.literal('click'),
	ref: z
		.string()
		.describe('Element reference from snap (e.g., "e42")')
		.optional(),
	selector: selectorSchema.optional(),
	tab: tabRefSchema.optional(),
	button: z.enum(['left', 'right', 'middle']).default('left'),
	clickCount: z.number().int().min(1).max(3).default(1),
})

const typeAction = z.object({
	action: z.literal('type'),
	ref: z.string().describe('Input element reference from snap').optional(),
	selector: selectorSchema.optional(),
	text: z.string().describe('Text to type'),
	tab: tabRefSchema.optional(),
	clear: z.boolean().default(false).describe('Clear field before typing'),
	delay: z.number().min(0).default(0).describe('Delay between keystrokes (ms)'),
})

const selectAction = z.object({
	action: z.literal('select'),
	ref: z.string().describe('Select element reference').optional(),
	selector: selectorSchema.optional(),
	value: z.string().describe('Option value to select'),
	tab: tabRefSchema.optional(),
})

const hoverAction = z.object({
	action: z.literal('hover'),
	ref: z.string().describe('Element reference to hover').optional(),
	selector: selectorSchema.optional(),
	tab: tabRefSchema.optional(),
})

const scrollAction = z.object({
	action: z.literal('scroll'),
	ref: z.string().optional().describe('Element reference to scroll'),
	selector: selectorSchema.optional().describe('Element selector to scroll'),
	tab: tabRefSchema.optional(),
	x: z.number().default(0).describe('Horizontal scroll delta'),
	y: z.number().default(0).describe('Vertical scroll delta'),
})

// ============================================================================
// Wait Actions
// ============================================================================

const waitForAction = z.object({
	action: z.literal('waitFor'),
	ref: z.string().describe('Element reference to wait for').optional(),
	selector: selectorSchema.optional(),
	state: z
		.enum(['visible', 'hidden', 'attached', 'detached'])
		.default('visible'),
	timeout: z
		.number()
		.min(0)
		.max(30_000)
		.default(5000)
		.describe('Timeout in milliseconds'),
	tab: tabRefSchema.optional(),
})

const waitForNavigationAction = z.object({
	action: z.literal('waitForNavigation'),
	tab: tabRefSchema.optional(),
	timeout: z.number().min(0).max(30_000).default(10_000),
})

const waitAction = z.object({
	action: z.literal('wait'),
	ms: z.number().min(0).max(10_000).describe('Milliseconds to wait'),
})

// ============================================================================
// Capture Actions
// ============================================================================

const snapAction = z.object({
	action: z.literal('snap'),
	tab: tabRefSchema.optional(),
	interactive: z.boolean().optional().describe('Interactive elements only'),
	visibleOnly: z.boolean().optional().describe('Show only visible elements'),
	compact: z.boolean().optional().describe('Compact tree output'),
	depth: z.number().int().min(0).optional().describe('Max depth for output'),
	selector: selectorSchema.optional().describe('Scope snap to selector'),
})

const screenshotAction = z.object({
	action: z.literal('screenshot'),
	tab: tabRefSchema.optional(),
	ref: z.string().optional().describe('Element reference to capture'),
	selector: selectorSchema.optional().describe('Element selector to capture'),
	fullPage: z.boolean().default(false).describe('Capture full scrollable page'),
	quality: z
		.number()
		.min(0)
		.max(100)
		.default(85)
		.describe('JPEG quality (ignored for PNG)'),
})

const htmlAction = z.object({
	action: z.literal('html'),
	tab: tabRefSchema.optional(),
	ref: z
		.string()
		.optional()
		.describe('Element reference to get HTML (default: body)'),
	selector: selectorSchema
		.optional()
		.describe('Element selector to get HTML (default: body)'),
})

const textAction = z.object({
	action: z.literal('text'),
	tab: tabRefSchema.optional(),
	ref: z
		.string()
		.optional()
		.describe('Element reference to get text (default: body)'),
	selector: selectorSchema
		.optional()
		.describe('Element selector to get text (default: body)'),
})

// ============================================================================
// Marker Actions
// ============================================================================

const markerAction = z.object({
	action: z.literal('marker'),
	selector: selectorSchema,
	name: z.string().optional(),
	tags: z.array(z.string()).optional(),
	tab: tabRefSchema.optional(),
})

const markersAction = z.object({
	action: z.literal('markers'),
	selector: selectorSchema.optional(),
	unreadOnly: z.boolean().default(false),
	limit: z.number().int().min(1).max(1000).default(50),
})

const markerReadAction = z.object({
	action: z.literal('markerRead'),
	id: z.string(),
})

const markerGetAction = z.object({
	action: z.literal('markerGet'),
	id: z.string(),
	includeFiles: z.boolean().default(true),
	includeScreenshot: z.boolean().default(false),
})

// ============================================================================
// Display Actions
// ============================================================================

const viewportAction = z.object({
	action: z.literal('viewport'),
	tab: tabRefSchema.optional(),
	preset: z
		.enum(['mobile', 'tablet', 'desktop', 'desktop-xl', 'desktop-2xl'])
		.optional(),
	width: z.number().int().min(320).max(3840).optional(),
	height: z.number().int().min(240).max(2160).optional(),
})

const colorSchemeAction = z.object({
	action: z.literal('colorScheme'),
	tab: tabRefSchema.optional(),
	scheme: z.enum(['light', 'dark', 'no-preference']),
})

const modeAction = z.object({
	action: z.literal('mode'),
	target: z.enum(['headless', 'windowed', 'paired']),
})

// ============================================================================
// Combined Action Schema (Single MCP Tool Pattern)
// ============================================================================

export const navigatorActionSchema = z
	.discriminatedUnion('action', [
		// Navigation
		navigateAction,
		backAction,
		forwardAction,
		reloadAction,
		// Tabs
		tabAction,
		tabsAction,
		newTabAction,
		closeTabAction,
		// Interaction
		clickAction,
		typeAction,
		selectAction,
		hoverAction,
		scrollAction,
		// Wait
		waitForAction,
		waitForNavigationAction,
		waitAction,
		// Capture
		snapAction,
		screenshotAction,
		htmlAction,
		textAction,
		// Markers
		markerAction,
		markersAction,
		markerReadAction,
		markerGetAction,
		// Display
		viewportAction,
		colorSchemeAction,
		modeAction,
	])
	.superRefine((value, ctx) => {
		const needsTarget = new Set(['click', 'type', 'select', 'hover', 'waitFor'])
		if (!needsTarget.has(value.action)) {
			return
		}

		const candidate = value as {
			ref?: string
			selector?: string
			action: string
		}
		if (candidate.ref || candidate.selector) {
			return
		}

		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: `${value.action} requires ref or selector`,
			path: ['ref'],
		})
	})

export type NavigatorAction = z.infer<typeof navigatorActionSchema>

// ============================================================================
// Action Categories (for documentation/filtering)
// ============================================================================

export const ACTION_CATEGORIES = {
	navigation: ['navigate', 'back', 'forward', 'reload'] as const,
	tabs: ['tab', 'tabs', 'newTab', 'closeTab'] as const,
	interaction: ['click', 'type', 'select', 'hover', 'scroll'] as const,
	wait: ['waitFor', 'waitForNavigation', 'wait'] as const,
	capture: ['snap', 'screenshot', 'html', 'text'] as const,
	markers: ['marker', 'markers', 'markerRead', 'markerGet'] as const,
	display: ['viewport', 'colorScheme', 'mode'] as const,
} as const

export type ActionCategory = keyof typeof ACTION_CATEGORIES

// ============================================================================
// Result Types
// ============================================================================

/**
 * Snapshot node in ARIA tree representation
 */
export interface SnapNode {
	role: string
	name?: string
	ref?: string
	symbol?: string
	children?: SnapNode[]
}

/**
 * Page snapshot with element metadata
 */
export interface PageSnap {
	version: number
	timestamp: number
	url: string
	title: string
	tree: SnapNode | string
	interactiveCount: number
}

/**
 * Result of executing an action
 */
export interface ActionResult {
	success: boolean
	error?: string
	extractedContent?: string
	domChanges?: string
	screenshot?: string
	snap?: PageSnap
	data?: unknown
}
