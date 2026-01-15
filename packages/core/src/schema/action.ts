/**
 * Action Schema
 *
 * Defines all Navigator actions as a discriminated union.
 * Actions use 'snap' instead of 'snapshot' and 'paired' instead of 'guided'.
 */

import { z } from 'zod'

// Element reference pattern: e42 or @e42 or e42_1
const elementRefPattern = /^@?e\d+(_\d+)?$/

// Tab reference: number, "b0"-style string, or 4-char URL hash
const tabRefSchema = z.union([z.number(), z.string()])

// ============================================================================
// Navigation Actions
// ============================================================================

const navigateAction = z.object({
	action: z.literal('navigate'),
	url: z.string(),
	tab: tabRefSchema.optional(),
	waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
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
})

// ============================================================================
// Tab Actions
// ============================================================================

const tabAction = z.object({
	action: z.literal('tab'),
	ref: tabRefSchema,
})

const tabsAction = z.object({
	action: z.literal('tabs'),
})

const newTabAction = z.object({
	action: z.literal('newTab'),
	url: z.string().optional(),
})

const closeTabAction = z.object({
	action: z.literal('closeTab'),
	ref: tabRefSchema,
})

// ============================================================================
// Interaction Actions
// ============================================================================

const clickAction = z.object({
	action: z.literal('click'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	tab: tabRefSchema.optional(),
	button: z.enum(['left', 'right', 'middle']).optional(),
	clickCount: z.number().optional(),
})

const typeAction = z.object({
	action: z.literal('type'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	text: z.string(),
	tab: tabRefSchema.optional(),
	clear: z.boolean().optional(),
	delay: z.number().optional(),
})

const selectAction = z.object({
	action: z.literal('select'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	value: z.string(),
	tab: tabRefSchema.optional(),
})

const hoverAction = z.object({
	action: z.literal('hover'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	tab: tabRefSchema.optional(),
})

const focusAction = z.object({
	action: z.literal('focus'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	tab: tabRefSchema.optional(),
})

const scrollAction = z.object({
	action: z.literal('scroll'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	tab: tabRefSchema.optional(),
})

// ============================================================================
// Wait Actions
// ============================================================================

const waitForAction = z.object({
	action: z.literal('waitFor'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional(),
	timeout: z.number().optional(),
	tab: tabRefSchema.optional(),
})

const waitForNavigationAction = z.object({
	action: z.literal('waitForNavigation'),
	tab: tabRefSchema.optional(),
	timeout: z.number().optional(),
})

const waitAction = z.object({
	action: z.literal('wait'),
	ms: z.number(),
})

// ============================================================================
// Capture Actions
// ============================================================================

const screenshotAction = z.object({
	action: z.literal('screenshot'),
	tab: tabRefSchema.optional(),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	fullPage: z.boolean().optional(),
	quality: z.number().optional(),
})

// 'snap' instead of 'snapshot'
const snapAction = z.object({
	action: z.literal('snap'),
	tab: tabRefSchema.optional(),
	mode: z.enum(['full', 'interactive', 'input_fields', 'text_only']).optional(),
	interactive: z.boolean().optional(),
	compact: z.boolean().optional(),
	depth: z.number().optional(),
	selector: z.string().optional(),
	visibleOnly: z.boolean().optional(),
})

const htmlAction = z.object({
	action: z.literal('html'),
	tab: tabRefSchema.optional(),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
})

const textAction = z.object({
	action: z.literal('text'),
	tab: tabRefSchema.optional(),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
})

// ============================================================================
// Marker Actions
// ============================================================================

const markerAction = z.object({
	action: z.literal('marker'),
	geometry: z.discriminatedUnion('type', [
		z.object({ type: z.literal('point'), x: z.number(), y: z.number() }),
		z.object({
			type: z.literal('region'),
			x: z.number(),
			y: z.number(),
			width: z.number(),
			height: z.number(),
		}),
	]),
	tab: tabRefSchema.optional(),
	note: z.string().optional(),
})

const markersAction = z.object({
	action: z.literal('markers'),
	format: z.enum(['json', 'markdown']).optional(),
})

const markerGetAction = z.object({
	action: z.literal('markerGet'),
	id: z.string().uuid(),
})

const markerReadAction = z.object({
	action: z.literal('markerRead'),
	ids: z.array(z.string().uuid()).optional(),
})

const markerDeleteAction = z.object({
	action: z.literal('markerDelete'),
	id: z.string().uuid(),
})

const markerCompareAction = z.object({
	action: z.literal('markerCompare'),
	id1: z.string().uuid(),
	id2: z.string().uuid(),
})

// ============================================================================
// Display Actions
// ============================================================================

const viewportAction = z.object({
	action: z.literal('viewport'),
	tab: tabRefSchema.optional(),
	preset: z.enum(['mobile', 'tablet', 'desktop']).optional(),
	width: z.number().optional(),
	height: z.number().optional(),
})

const colorSchemeAction = z.object({
	action: z.literal('colorScheme'),
	tab: tabRefSchema.optional(),
	scheme: z.enum(['light', 'dark', 'no-preference']),
})

// 'paired' instead of 'guided'
const modeAction = z.object({
	action: z.literal('mode'),
	target: z.enum(['headless', 'windowed', 'paired']),
})

// ============================================================================
// Evaluate Action
// ============================================================================

const evaluateAction = z.object({
	action: z.literal('evaluate'),
	script: z.string(),
	args: z.array(z.unknown()).optional(),
	tab: tabRefSchema.optional(),
})

// ============================================================================
// Session Actions
// ============================================================================

const sessionAction = z.object({
	action: z.literal('session'),
})

const sessionsAction = z.object({
	action: z.literal('sessions'),
	limit: z.number().optional(),
})

const stepsAction = z.object({
	action: z.literal('steps'),
	sessionId: z.string().uuid().optional(),
	limit: z.number().optional(),
})

// ============================================================================
// Discriminated Union
// ============================================================================

export const ActionSchema = z.discriminatedUnion('action', [
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
	focusAction,
	scrollAction,
	// Wait
	waitForAction,
	waitForNavigationAction,
	waitAction,
	// Capture
	screenshotAction,
	snapAction,
	htmlAction,
	textAction,
	// Markers
	markerAction,
	markersAction,
	markerGetAction,
	markerReadAction,
	markerDeleteAction,
	markerCompareAction,
	// Display
	viewportAction,
	colorSchemeAction,
	modeAction,
	// Evaluate
	evaluateAction,
	// Session
	sessionAction,
	sessionsAction,
	stepsAction,
])

export type Action = z.infer<typeof ActionSchema>

// Type aliases for specific actions
export type NavigateAction = z.infer<typeof navigateAction>
export type ClickAction = z.infer<typeof clickAction>
export type TypeAction = z.infer<typeof typeAction>
export type SnapAction = z.infer<typeof snapAction>
export type MarkerAction = z.infer<typeof markerAction>
export type ModeAction = z.infer<typeof modeAction>

// Browser mode type (uses 'paired' instead of 'guided')
export type BrowserMode = 'headless' | 'windowed' | 'paired'

// Tab reference type
export type TabRef = number | string
