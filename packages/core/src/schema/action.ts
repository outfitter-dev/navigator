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

const pressAction = z.object({
	action: z.literal('press'),
	key: z.string().min(1),
	tab: tabRefSchema.optional(),
})

const fillAction = z.object({
	action: z.literal('fill'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	value: z.string(),
	tab: tabRefSchema.optional(),
})

const findAction = z.object({
	action: z.literal('find'),
	// Search criteria
	text: z.string().optional(),
	exact: z.boolean().optional(),
	role: z.string().optional(),
	label: z.string().optional(),
	placeholder: z.string().optional(),
	testid: z.string().optional(),
	ref: z.string().regex(elementRefPattern).optional(),
	// Scoping
	inRef: z.string().optional(),
	inCss: z.string().optional(),
	inTag: z.string().optional(),
	// Filtering
	tag: z.string().optional(),
	visible: z.boolean().optional(),
	enabled: z.boolean().optional(),
	checked: z.boolean().optional(),
	tab: tabRefSchema.optional(),
})

const checkAction = z.object({
	action: z.literal('check'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	tab: tabRefSchema.optional(),
})

const uncheckAction = z.object({
	action: z.literal('uncheck'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	tab: tabRefSchema.optional(),
})

const uploadAction = z.object({
	action: z.literal('upload'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	files: z.array(z.string()).min(1),
	tab: tabRefSchema.optional(),
})

const downloadAction = z.object({
	action: z.literal('download'),
	ref: z.string().regex(elementRefPattern).optional(),
	selector: z.string().optional(),
	path: z.string(),
	wait: z.boolean().default(true),
	timeout: z.number().optional(),
	tab: tabRefSchema.optional(),
})

const dialogAction = z.object({
	action: z.literal('dialog'),
	handler: z.enum(['accept', 'dismiss', 'prompt', 'clear']),
	text: z.string().optional(),
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
	view: z.string().optional(),
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
	view: z.string().optional(),
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

// Geometry schema for markers (point or region)
const markerGeometrySchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('point'), x: z.number(), y: z.number() }),
	z.object({
		type: z.literal('region'),
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),
	}),
])

const markerAction = z.object({
	action: z.literal('marker'),
	// Geometry is optional when ref is provided (derived from element bounding box)
	geometry: markerGeometrySchema.optional(),
	// Element ref from snap (e.g., "e5") - auto-captures element metadata
	ref: z.string().regex(elementRefPattern).optional(),
	tab: tabRefSchema.optional(),
	note: z.string().optional(),
	// Tags for filtering and organization
	tags: z.array(z.string()).optional(),
})

const markersAction = z.object({
	action: z.literal('markers'),
	format: z.enum(['json', 'markdown']).optional(),
	// Filter parameters
	tags: z.array(z.string()).optional(),
	url: z.string().optional(),
	role: z.string().optional(),
})

const markerGetAction = z.object({
	action: z.literal('markerGet'),
	id: z.string().uuid(),
	includeScreenshot: z.boolean().optional(),
})

const markerReadAction = z.object({
	action: z.literal('markerRead'),
	ids: z.array(z.string().uuid()).optional(),
	includeScreenshot: z.boolean().optional(),
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

const markerResolveAction = z.object({
	action: z.literal('markerResolve'),
	id: z.string().uuid(),
	tab: tabRefSchema.optional(),
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
// Sequence Action
// ============================================================================

/**
 * Sequence action for batch execution of multiple typed actions.
 *
 * Enables Ami-style efficiency (fewer round trips) while maintaining
 * Navigator's safety guarantees (Zod validation, step logging).
 *
 * Note: Uses z.any() for steps array due to circular reference constraints
 * with discriminated unions. Runtime validation happens in SequenceExecutor.
 */
const sequenceAction = z.object({
	action: z.literal('sequence'),
	/** Array of actions to execute in sequence */
	steps: z.array(z.any()).min(1),
	/** Parameters for {{varName}} interpolation */
	params: z.record(z.unknown()).optional(),
	/** Stop execution on first error (default: true) */
	stopOnError: z.boolean().optional(),
	/** Optional name for logging */
	name: z.string().optional(),
})

// ============================================================================
// Discriminated Union
// ============================================================================

const baseActionSchema = z.discriminatedUnion('action', [
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
	pressAction,
	fillAction,
	findAction,
	checkAction,
	uncheckAction,
	uploadAction,
	downloadAction,
	dialogAction,
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
	markerResolveAction,
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
	// Sequence
	sequenceAction,
])

// Add cross-field validation for actions that require ref or selector
export const ActionSchema = baseActionSchema.superRefine((data, ctx) => {
	if (data.action === 'check' || data.action === 'uncheck') {
		if (data.ref === undefined && data.selector === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Either ref or selector is required',
			})
		}
	}
	// Marker action requires either geometry or ref
	if (data.action === 'marker') {
		if (data.geometry === undefined && data.ref === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Either geometry or ref is required',
			})
		}
	}
})

export type Action = z.infer<typeof ActionSchema>

// Type aliases for specific actions
export type NavigateAction = z.infer<typeof navigateAction>
export type ClickAction = z.infer<typeof clickAction>
export type TypeAction = z.infer<typeof typeAction>
export type SnapAction = z.infer<typeof snapAction>
export type MarkerAction = z.infer<typeof markerAction>
export type MarkersAction = z.infer<typeof markersAction>
export type MarkerResolveAction = z.infer<typeof markerResolveAction>
export type ModeAction = z.infer<typeof modeAction>
export type PressAction = z.infer<typeof pressAction>
export type FillAction = z.infer<typeof fillAction>
export type FindAction = z.infer<typeof findAction>
export type CheckAction = z.infer<typeof checkAction>
export type UncheckAction = z.infer<typeof uncheckAction>
export type UploadAction = z.infer<typeof uploadAction>
export type DownloadAction = z.infer<typeof downloadAction>
export type DialogAction = z.infer<typeof dialogAction>
export type ScreenshotAction = z.infer<typeof screenshotAction>
export type SequenceAction = z.infer<typeof sequenceAction>

// Browser mode type (uses 'paired' instead of 'guided')
export type BrowserMode = 'headless' | 'windowed' | 'paired'

// Tab reference type
export type TabRef = number | string
