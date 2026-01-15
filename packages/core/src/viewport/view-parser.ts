/**
 * View Flag Parser Module
 *
 * Parses --view flag values into viewport specifications.
 *
 * @module viewport/view-parser
 */

import {
	TAILWIND_BREAKPOINTS,
	VIEWPORT_PRESETS,
	getViewportDimensions,
} from './presets'
import type {
	ResolvedViewport,
	TailwindBreakpoint,
	ViewSpec,
	ViewportOrientation,
	ViewportOrientationWithBoth,
} from './types'

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid orientation values for --view flag
 */
const VALID_ORIENTATIONS = new Set(['portrait', 'landscape', 'both'])

/**
 * Shorthand expansions for common viewport sets
 */
const VIEW_SHORTHANDS: Record<string, string[]> = {
	responsive: ['mobile', 'tablet', 'slate', 'laptop', 'desktop'],
	all: ['mobile', 'mobile-xl', 'tablet', 'slate', 'laptop', 'desktop'],
}

/**
 * Validate an orientation value
 */
function validateOrientation(orient: string, spec: string): void {
	if (!VALID_ORIENTATIONS.has(orient)) {
		throw new Error(
			`Invalid orientation '${orient}' in '${spec}'. Valid values: portrait, landscape, both`,
		)
	}
}

/**
 * Parse a --view flag value into viewport specifications
 *
 * Supported formats:
 * - Single preset: 'mobile', 'tablet', 'laptop'
 * - Preset with orientation: 'mobile:landscape', 'tablet:portrait', 'tablet:both'
 * - Multiple presets: 'mobile,tablet,laptop'
 * - Raw breakpoint: 'lg', 'xs', '2xl'
 * - Raw width: '500'
 * - Explicit dimensions: '500x800', '1920x1080'
 * - Shorthands: 'responsive' (5 presets), 'all' (6 presets)
 * - Shorthands with orientation: 'all:portrait', 'all:both'
 *
 * @param value - The --view flag value to parse
 * @returns Array of parsed view specifications
 *
 * @example
 * ```ts
 * parseViewFlag('mobile')
 * // [{ preset: 'mobile' }]
 *
 * parseViewFlag('mobile:landscape')
 * // [{ preset: 'mobile', orientation: 'landscape' }]
 *
 * parseViewFlag('mobile,tablet')
 * // [{ preset: 'mobile' }, { preset: 'tablet' }]
 *
 * parseViewFlag('500x800')
 * // [{ width: 500, height: 800 }]
 *
 * parseViewFlag('responsive')
 * // [{ preset: 'mobile' }, { preset: 'tablet' }, { preset: 'slate' }, { preset: 'laptop' }, { preset: 'desktop' }]
 * ```
 */
export function parseViewFlag(value: string): ViewSpec[] {
	if (!value || value.trim() === '') {
		throw new Error('View flag value cannot be empty')
	}

	// Handle shorthands with orientation (all:portrait, all:both, responsive:landscape)
	if (value.startsWith('all:') || value.startsWith('responsive:')) {
		const parts = value.split(':')
		const shorthand = parts[0] as string
		const orient = parts[1] as string
		const presets = VIEW_SHORTHANDS[shorthand] as string[]

		// Validate orientation
		validateOrientation(orient, value)

		// For 'both', expand to two entries per preset
		if (orient === 'both') {
			return presets.flatMap((p: string) => [
				{ preset: p, orientation: 'portrait' as ViewportOrientationWithBoth },
				{ preset: p, orientation: 'landscape' as ViewportOrientationWithBoth },
			])
		}

		return presets.map((p: string) => ({
			preset: p,
			orientation: orient as ViewportOrientationWithBoth,
		}))
	}

	// Handle plain shorthands (responsive, all)
	if (VIEW_SHORTHANDS[value]) {
		return VIEW_SHORTHANDS[value].map((p) => ({ preset: p }))
	}

	// Parse comma-separated specs
	return value.split(',').map((spec) => parseSpec(spec.trim()))
}

/**
 * Parse a single view specification
 */
function parseSpec(spec: string): ViewSpec {
	// Check for orientation modifier (preset:orientation)
	if (spec.includes(':')) {
		const parts = spec.split(':')
		const base = parts[0] as string
		const orient = parts[1] as string

		// Validate orientation
		validateOrientation(orient, spec)

		return {
			preset: base,
			orientation: orient as ViewportOrientationWithBoth,
		}
	}

	// Check if it's a preset
	if (VIEWPORT_PRESETS[spec]) {
		return { preset: spec }
	}

	// Check if it's a breakpoint
	if (spec in TAILWIND_BREAKPOINTS) {
		return { breakpoint: spec as TailwindBreakpoint }
	}

	// Check if explicit dimensions (WxH)
	if (spec.includes('x')) {
		const parts = spec.split('x')
		const wStr = parts[0] as string
		const hStr = parts[1] as string

		// Validate both parts exist and are non-empty
		if (!wStr || !hStr) {
			throw new Error(
				`Invalid dimensions '${spec}'. Both width and height must be numbers (e.g., 500x800)`,
			)
		}

		const w = Number(wStr)
		const h = Number(hStr)

		// Validate both dimensions are valid numbers
		if (Number.isNaN(w) || Number.isNaN(h)) {
			throw new Error(
				`Invalid dimensions '${spec}'. Both width and height must be numbers (e.g., 500x800)`,
			)
		}

		return { width: w, height: h }
	}

	// Raw width (number only)
	const width = Number(spec)
	if (!Number.isNaN(width)) {
		return { width }
	}

	throw new Error(`Invalid view spec: ${spec}`)
}

/**
 * Resolve a --view flag value to fully resolved viewport dimensions
 *
 * Takes the parsed specifications and resolves them to concrete dimensions.
 *
 * @param value - The --view flag value to resolve
 * @returns Array of resolved viewports with concrete dimensions
 *
 * @example
 * ```ts
 * resolveViewFlag('mobile')
 * // [{ name: 'mobile', width: 375, height: 812, orientation: 'portrait' }]
 *
 * resolveViewFlag('mobile:landscape')
 * // [{ name: 'mobile', width: 812, height: 375, orientation: 'landscape' }]
 *
 * resolveViewFlag('500x800')
 * // [{ width: 500, height: 800 }]
 *
 * resolveViewFlag('responsive')
 * // Returns 5 resolved viewports
 * ```
 */
export function resolveViewFlag(value: string): ResolvedViewport[] {
	const specs = parseViewFlag(value)
	return specs.flatMap((spec) => resolveSpec(spec))
}

/**
 * Resolve a single ViewSpec to concrete dimensions
 */
function resolveSpec(spec: ViewSpec): ResolvedViewport[] {
	// Handle 'both' orientation - return two viewports
	if (spec.orientation === 'both' && spec.preset) {
		const preset = VIEWPORT_PRESETS[spec.preset]
		if (!preset) {
			throw new Error(`Unknown preset: ${spec.preset}`)
		}
		const { width, height } = preset
		return [
			{
				name: spec.preset,
				width,
				height,
				orientation: preset.orientation,
			},
			{
				name: spec.preset,
				width: height,
				height: width,
				orientation:
					preset.orientation === 'portrait' ? 'landscape' : 'portrait',
			},
		]
	}

	// Preset with optional orientation
	if (spec.preset) {
		const preset = VIEWPORT_PRESETS[spec.preset]
		if (!preset) {
			throw new Error(`Unknown preset: ${spec.preset}`)
		}
		const dims = getViewportDimensions(
			spec.preset,
			spec.orientation as ViewportOrientation | undefined,
		)
		const orientation = spec.orientation ?? preset.orientation
		return [
			{
				name: spec.preset,
				...dims,
				orientation: orientation as ViewportOrientation,
			},
		]
	}

	// Breakpoint
	if (spec.breakpoint) {
		const dims = getViewportDimensions(spec.breakpoint)
		return [{ name: spec.breakpoint, ...dims }]
	}

	// Explicit dimensions (WxH)
	if (spec.width !== undefined && spec.height !== undefined) {
		return [{ width: spec.width, height: spec.height }]
	}

	// Raw width - derive height from default landscape ratio (16:10)
	if (spec.width !== undefined) {
		const height = Math.round(spec.width / (16 / 10))
		return [{ width: spec.width, height }]
	}

	throw new Error('Cannot resolve view spec')
}
