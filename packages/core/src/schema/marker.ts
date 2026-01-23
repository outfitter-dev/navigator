/**
 * Marker Schema
 *
 * Defines markers with point and region geometry types.
 * Supports both geometry-based annotations (regions, points) and
 * element-aware annotations (with CSS selectors and accessibility info).
 */

import { z } from 'zod'

// ============================================================================
// Geometry Types
// ============================================================================

export const PointGeometrySchema = z.object({
	type: z.literal('point'),
	x: z.number(),
	y: z.number(),
})

export type PointGeometry = z.infer<typeof PointGeometrySchema>

export const RegionGeometrySchema = z.object({
	type: z.literal('region'),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
})

export type RegionGeometry = z.infer<typeof RegionGeometrySchema>

export const GeometrySchema = z.discriminatedUnion('type', [
	PointGeometrySchema,
	RegionGeometrySchema,
])

export type Geometry = z.infer<typeof GeometrySchema>

// ============================================================================
// Marker Viewport Context
// ============================================================================

/**
 * Viewport context captured when a marker is created.
 * Enables "scroll to same position" use cases and viewport normalization.
 */
export const MarkerViewportSchema = z.object({
	width: z.number(),
	height: z.number(),
	scrollX: z.number(),
	scrollY: z.number(),
	devicePixelRatio: z.number(),
})

export type MarkerViewport = z.infer<typeof MarkerViewportSchema>

// ============================================================================
// Element Metadata (from Agentation)
// ============================================================================

/**
 * Bounding box for element annotations.
 * Captures the element's position and dimensions relative to viewport.
 */
export const BoundingBoxSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	top: z.number(),
	right: z.number(),
	bottom: z.number(),
	left: z.number(),
})

export type BoundingBox = z.infer<typeof BoundingBoxSchema>

/**
 * Accessibility information extracted from the element.
 */
export const AccessibilityInfoSchema = z.object({
	role: z.string().optional(),
	ariaLabel: z.string().optional(),
	ariaDescribedBy: z.string().optional(),
	tabIndex: z.number().optional(),
	ariaHidden: z.boolean().optional(),
	focusable: z.boolean().optional(),
})

export type AccessibilityInfo = z.infer<typeof AccessibilityInfoSchema>

/**
 * Element identity for stable element re-finding across sessions.
 * Used to locate the same element even after page changes.
 */
export const ElementIdentitySchema = z.object({
	/** data-testid attribute (most stable) */
	testId: z.string().optional(),
	/** Role and accessible name combo (e.g., "button:Submit") */
	roleAndName: z.string().optional(),
	/** Playwright-compatible selector */
	selector: z.string().optional(),
	/** Element text content (truncated) */
	textContent: z.string().optional(),
})

export type ElementIdentity = z.infer<typeof ElementIdentitySchema>

/**
 * Element metadata for element-aware annotations.
 * Captures rich context about the annotated DOM element.
 */
export const ElementMetadataSchema = z.object({
	/** CSS selector path (e.g., "form > div.actions > button") */
	selector: z.string(),
	/** Human-readable element name (e.g., "button 'Submit'") */
	elementName: z.string(),
	/** Full DOM ancestry path */
	fullPath: z.string().optional(),
	/** Selected text content, if any */
	selectedText: z.string().optional(),
	/** Element's bounding box */
	boundingBox: BoundingBoxSchema.optional(),
	/** CSS classes (cleaned, without module hashes) */
	cssClasses: z.string().optional(),
	/** Accessibility information */
	accessibility: AccessibilityInfoSchema.optional(),
	/** Computed styles snapshot (key visual properties) */
	computedStyles: z.record(z.string()).optional(),
	/** Stable identity for element re-finding */
	identity: ElementIdentitySchema.optional(),
})

export type ElementMetadata = z.infer<typeof ElementMetadataSchema>

// ============================================================================
// Marker Schema
// ============================================================================

export const MarkerSchema = z.object({
	id: z.string().uuid(),
	sessionId: z.string().uuid(),
	timestamp: z.string().datetime(),
	url: z.string(),
	title: z.string(),
	geometry: GeometrySchema,
	note: z.string().optional(),
	screenshotPath: z.string().optional(), // Relative path to screenshot file
	viewport: MarkerViewportSchema.optional(),
	// Element-aware annotation fields (from Agentation integration)
	element: ElementMetadataSchema.optional(),
	// Tags for filtering and organization
	tags: z.array(z.string()).optional(),
	// Original element ref from snap (e.g., "e5")
	sourceRef: z.string().optional(),
})

export type Marker = z.infer<typeof MarkerSchema>

// ============================================================================
// Marker Creation Input
// ============================================================================

export interface MarkerCreateInput {
	url: string
	title: string
	geometry: Geometry
	note?: string | undefined
	screenshot?: string | undefined
	viewport?: MarkerViewport | undefined
	/** Element metadata for element-aware annotations */
	element?: ElementMetadata | undefined
	/** Tags for filtering and organization */
	tags?: string[] | undefined
	/** Original element ref from snap (e.g., "e5") */
	sourceRef?: string | undefined
}
