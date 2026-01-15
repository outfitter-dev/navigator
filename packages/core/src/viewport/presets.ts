/**
 * Viewport Presets Module
 *
 * Tailwind-aligned viewport presets for responsive capture sets.
 *
 * @module viewport/presets
 */

import type {
	TailwindBreakpoint,
	ViewportOrientation,
	ViewportPreset,
} from './types'

// ============================================================================
// Tailwind Breakpoints
// ============================================================================

/**
 * Tailwind CSS default breakpoints in pixels
 *
 * | Name | Width |
 * |------|-------|
 * | xs   | 375   |
 * | sm   | 640   |
 * | md   | 768   |
 * | lg   | 1024  |
 * | xl   | 1280  |
 * | 2xl  | 1536  |
 */
export const TAILWIND_BREAKPOINTS: Record<TailwindBreakpoint, number> = {
	xs: 375,
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536,
}

// ============================================================================
// Viewport Presets
// ============================================================================

/**
 * Named viewport presets aligned with Tailwind breakpoints
 *
 * | Name      | Width  | Height | Orientation | Tailwind |
 * |-----------|--------|--------|-------------|----------|
 * | mobile    | 375    | 812    | portrait    | xs       |
 * | mobile-xl | 430    | 932    | portrait    | -        |
 * | tablet    | 768    | 1024   | portrait    | md       |
 * | slate     | 1024   | 1366   | portrait    | lg       |
 * | laptop    | 1280   | 800    | landscape   | xl       |
 * | desktop   | 1536   | 864    | landscape   | 2xl      |
 */
export const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
	mobile: {
		name: 'mobile',
		width: 375,
		height: 812,
		orientation: 'portrait',
		tailwind: 'xs',
	},
	'mobile-xl': {
		name: 'mobile-xl',
		width: 430,
		height: 932,
		orientation: 'portrait',
	},
	tablet: {
		name: 'tablet',
		width: 768,
		height: 1024,
		orientation: 'portrait',
		tailwind: 'md',
	},
	slate: {
		name: 'slate',
		width: 1024,
		height: 1366,
		orientation: 'portrait',
		tailwind: 'lg',
	},
	laptop: {
		name: 'laptop',
		width: 1280,
		height: 800,
		orientation: 'landscape',
		tailwind: 'xl',
	},
	desktop: {
		name: 'desktop',
		width: 1536,
		height: 864,
		orientation: 'landscape',
		tailwind: '2xl',
	},
}

// ============================================================================
// Breakpoint Heights
// ============================================================================

/**
 * Default heights for Tailwind breakpoints based on typical aspect ratios
 *
 * xs, md use portrait orientation (9:16-ish)
 * sm, lg, xl, 2xl use landscape orientation (16:10-ish)
 */
const BREAKPOINT_HEIGHTS: Record<TailwindBreakpoint, number> = {
	xs: 812,
	sm: 480,
	md: 1024,
	lg: 640,
	xl: 800,
	'2xl': 864,
}

/**
 * Default orientation for each breakpoint
 */
const BREAKPOINT_ORIENTATIONS: Record<TailwindBreakpoint, ViewportOrientation> =
	{
		xs: 'portrait',
		sm: 'landscape',
		md: 'portrait',
		lg: 'landscape',
		xl: 'landscape',
		'2xl': 'landscape',
	}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get viewport dimensions for a preset or breakpoint
 *
 * @param name - Preset name or Tailwind breakpoint
 * @param orientation - Override orientation (swaps width/height if different from default)
 * @returns Viewport dimensions { width, height }
 *
 * @example
 * ```ts
 * getViewportDimensions('mobile')
 * // { width: 375, height: 812 }
 *
 * getViewportDimensions('mobile', 'landscape')
 * // { width: 812, height: 375 }
 *
 * getViewportDimensions('lg')
 * // { width: 1024, height: 640 }
 * ```
 *
 * @throws Error if name is not a valid preset or breakpoint
 */
export function getViewportDimensions(
	name: string,
	orientation?: ViewportOrientation,
): { width: number; height: number } {
	// Check presets first
	const preset = VIEWPORT_PRESETS[name]
	if (preset) {
		let { width, height } = preset
		// If orientation specified and differs from default, flip
		if (orientation && orientation !== preset.orientation) {
			;[width, height] = [height, width]
		}
		return { width, height }
	}

	// Check breakpoints
	if (name in TAILWIND_BREAKPOINTS) {
		const bp = name as TailwindBreakpoint
		let width = TAILWIND_BREAKPOINTS[bp]
		let height = BREAKPOINT_HEIGHTS[bp]
		const defaultOrientation = BREAKPOINT_ORIENTATIONS[bp]
		if (orientation && orientation !== defaultOrientation) {
			;[width, height] = [height, width]
		}
		return { width, height }
	}

	throw new Error(`Unknown viewport: ${name}`)
}
