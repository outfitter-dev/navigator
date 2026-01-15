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
	xs: 0,
	sm: 0,
	md: 0,
	lg: 0,
	xl: 0,
	'2xl': 0,
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
export const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {}

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
	throw new Error('Not implemented')
}
