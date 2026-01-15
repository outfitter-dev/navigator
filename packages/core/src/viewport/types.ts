/**
 * Viewport Types Module
 *
 * Type definitions for the Tailwind-aligned viewport system.
 *
 * @module viewport/types
 */

/**
 * Tailwind CSS breakpoint names
 */
export type TailwindBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/**
 * Orientation options for viewports
 */
export type ViewportOrientation = 'portrait' | 'landscape'

/**
 * Extended orientation including 'both' for multi-capture scenarios
 */
export type ViewportOrientationWithBoth = ViewportOrientation | 'both'

/**
 * Complete viewport preset definition
 */
export interface ViewportPreset {
	/** Preset identifier */
	name: string
	/** Width in pixels */
	width: number
	/** Height in pixels */
	height: number
	/** Default orientation */
	orientation: ViewportOrientation
	/** Associated Tailwind breakpoint (if applicable) */
	tailwind?: TailwindBreakpoint
}

/**
 * Parsed view specification from --view flag
 *
 * Represents one of several input formats:
 * - Preset name: { preset: 'mobile' }
 * - Breakpoint: { breakpoint: 'lg' }
 * - Width only: { width: 500 }
 * - Explicit dimensions: { width: 500, height: 800 }
 */
export interface ViewSpec {
	/** Named preset reference */
	preset?: string
	/** Tailwind breakpoint reference */
	breakpoint?: TailwindBreakpoint
	/** Explicit width */
	width?: number
	/** Explicit height */
	height?: number
	/** Orientation modifier */
	orientation?: ViewportOrientationWithBoth
}

/**
 * Fully resolved viewport with concrete dimensions
 */
export interface ResolvedViewport {
	/** Preset name (if from a preset) */
	name?: string
	/** Resolved width in pixels */
	width: number
	/** Resolved height in pixels */
	height: number
	/** Resolved orientation (if applicable) */
	orientation?: ViewportOrientation
}
