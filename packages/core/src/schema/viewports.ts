/**
 * Viewport Presets Module
 *
 * Apple device-centric viewport definitions for responsive capture sets.
 * Supports portrait/landscape orientations and preset expansions.
 *
 * @module schema/viewports
 */

import { z } from 'zod'

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Viewport dimensions schema
 */
export const viewportDimensionsSchema = z.object({
	width: z.number().int().min(320).max(7680),
	height: z.number().int().min(240).max(4320),
})

/**
 * Orientation schema
 */
export const orientationSchema = z.enum(['portrait', 'landscape', 'both'])

/**
 * Viewport preset name schema
 */
export const viewportPresetNameSchema = z.enum([
	'mobile',
	'mobile-lg',
	'tablet-sm',
	'tablet',
	'tablet-lg',
	'laptop',
	'laptop-lg',
	'desktop',
	'desktop-lg',
])

/**
 * Shorthand preset expansion schema
 */
export const presetShorthandSchema = z.enum([
	'responsive',
	'responsive-full',
	'mobile-first',
])

/**
 * Combined preset reference schema (supports names and shorthands)
 */
export const presetRefSchema = z.union([
	viewportPresetNameSchema,
	presetShorthandSchema,
])

// ============================================================================
// Types
// ============================================================================

export type ViewportDimensions = z.infer<typeof viewportDimensionsSchema>
export type Orientation = z.infer<typeof orientationSchema>
export type ViewportPresetName = z.infer<typeof viewportPresetNameSchema>
export type PresetShorthand = z.infer<typeof presetShorthandSchema>
export type PresetRef = z.infer<typeof presetRefSchema>

/**
 * Complete viewport preset definition with device metadata
 */
export interface ViewportPreset {
	/** Preset identifier */
	name: ViewportPresetName
	/** Portrait dimensions (null for landscape-only devices) */
	portrait: ViewportDimensions | null
	/** Landscape dimensions */
	landscape: ViewportDimensions
	/** Reference device name */
	device: string
}

/**
 * Resolved viewport with orientation context
 */
export interface ResolvedViewport {
	/** Preset name */
	name: ViewportPresetName
	/** Viewport dimensions */
	dimensions: ViewportDimensions
	/** Applied orientation */
	orientation: 'portrait' | 'landscape'
	/** Reference device */
	device: string
}

// ============================================================================
// Preset Definitions
// ============================================================================

/**
 * Apple device-centric viewport presets
 *
 * | Name        | Portrait  | Landscape  | Device              |
 * |-------------|-----------|------------|---------------------|
 * | mobile      | 393x852   | 852x393    | iPhone 17           |
 * | mobile-lg   | 440x956   | 956x440    | iPhone 17 Pro Max   |
 * | tablet-sm   | 744x1133  | 1133x744   | iPad mini (7th)     |
 * | tablet      | 834x1194  | 1194x834   | iPad Pro 11"        |
 * | tablet-lg   | 1024x1366 | 1366x1024  | iPad Pro 13"        |
 * | laptop      | -         | 1470x956   | MacBook Air 14"     |
 * | laptop-lg   | -         | 1728x1117  | MacBook Pro 16"     |
 * | desktop     | -         | 2560x1440  | Studio Display 27"  |
 * | desktop-lg  | -         | 3008x1692  | Pro Display XDR     |
 */
export const VIEWPORT_PRESETS: Record<ViewportPresetName, ViewportPreset> = {
	mobile: {
		name: 'mobile',
		portrait: { width: 393, height: 852 },
		landscape: { width: 852, height: 393 },
		device: 'iPhone 17',
	},
	'mobile-lg': {
		name: 'mobile-lg',
		portrait: { width: 440, height: 956 },
		landscape: { width: 956, height: 440 },
		device: 'iPhone 17 Pro Max',
	},
	'tablet-sm': {
		name: 'tablet-sm',
		portrait: { width: 744, height: 1133 },
		landscape: { width: 1133, height: 744 },
		device: 'iPad mini (7th)',
	},
	tablet: {
		name: 'tablet',
		portrait: { width: 834, height: 1194 },
		landscape: { width: 1194, height: 834 },
		device: 'iPad Pro 11"',
	},
	'tablet-lg': {
		name: 'tablet-lg',
		portrait: { width: 1024, height: 1366 },
		landscape: { width: 1366, height: 1024 },
		device: 'iPad Pro 13"',
	},
	laptop: {
		name: 'laptop',
		portrait: null,
		landscape: { width: 1470, height: 956 },
		device: 'MacBook Air 14"',
	},
	'laptop-lg': {
		name: 'laptop-lg',
		portrait: null,
		landscape: { width: 1728, height: 1117 },
		device: 'MacBook Pro 16"',
	},
	desktop: {
		name: 'desktop',
		portrait: null,
		landscape: { width: 2560, height: 1440 },
		device: 'Studio Display 27"',
	},
	'desktop-lg': {
		name: 'desktop-lg',
		portrait: null,
		landscape: { width: 3008, height: 1692 },
		device: 'Pro Display XDR',
	},
} as const

// ============================================================================
// Shorthand Expansions
// ============================================================================

/**
 * Shorthand preset expansions for common use cases
 */
export const PRESET_EXPANSIONS: Record<
	PresetShorthand,
	readonly ViewportPresetName[]
> = {
	/** Core responsive breakpoints: mobile, tablet, laptop, desktop */
	responsive: ['mobile', 'tablet', 'laptop', 'desktop'],
	/** All 9 presets for comprehensive coverage */
	'responsive-full': [
		'mobile',
		'mobile-lg',
		'tablet-sm',
		'tablet',
		'tablet-lg',
		'laptop',
		'laptop-lg',
		'desktop',
		'desktop-lg',
	],
	/** Mobile-first progression: mobile, tablet-sm, tablet */
	'mobile-first': ['mobile', 'tablet-sm', 'tablet'],
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a preset supports portrait orientation
 */
export function supportsPortrait(name: ViewportPresetName): boolean {
	return VIEWPORT_PRESETS[name].portrait !== null
}

/**
 * Check if a string is a valid preset name
 */
export function isPresetName(name: string): name is ViewportPresetName {
	return viewportPresetNameSchema.safeParse(name).success
}

/**
 * Check if a string is a shorthand expansion
 */
export function isShorthand(name: string): name is PresetShorthand {
	return presetShorthandSchema.safeParse(name).success
}

/**
 * Get viewport dimensions for a preset with specified orientation
 *
 * @param name - Viewport preset name
 * @param orientation - Desired orientation (default: 'landscape')
 * @returns Resolved viewport with dimensions, or null if orientation not supported
 *
 * @example
 * ```ts
 * getViewport('mobile', 'portrait')
 * // { name: 'mobile', dimensions: { width: 393, height: 852 }, orientation: 'portrait', device: 'iPhone 17' }
 *
 * getViewport('laptop', 'portrait')
 * // null (laptops don't support portrait)
 *
 * getViewport('laptop')
 * // { name: 'laptop', dimensions: { width: 1470, height: 956 }, orientation: 'landscape', device: 'MacBook Air 14"' }
 * ```
 */
export function getViewport(
	name: ViewportPresetName,
	orientation: 'portrait' | 'landscape' = 'landscape',
): ResolvedViewport | null {
	const preset = VIEWPORT_PRESETS[name]

	if (orientation === 'portrait') {
		if (!preset.portrait) {
			return null
		}
		return {
			name,
			dimensions: preset.portrait,
			orientation: 'portrait',
			device: preset.device,
		}
	}

	return {
		name,
		dimensions: preset.landscape,
		orientation: 'landscape',
		device: preset.device,
	}
}

/**
 * Expand a preset reference to its constituent preset names
 */
function expandPresetRef(ref: PresetRef): ViewportPresetName[] {
	if (isShorthand(ref)) {
		return [...PRESET_EXPANSIONS[ref]]
	}
	return [ref]
}

/**
 * Resolve viewport names to full viewport definitions
 *
 * Supports:
 * - Individual preset names ('mobile', 'tablet', etc.)
 * - Shorthand expansions ('responsive', 'responsive-full', 'mobile-first')
 * - Orientation filtering ('portrait', 'landscape', 'both')
 *
 * @param names - Array of preset names or shorthands
 * @param orientation - Orientation to resolve (default: 'landscape')
 * @returns Array of resolved viewports
 *
 * @example
 * ```ts
 * // Single preset
 * resolveViewports(['mobile'], 'portrait')
 * // [{ name: 'mobile', dimensions: { width: 393, height: 852 }, orientation: 'portrait', device: 'iPhone 17' }]
 *
 * // Shorthand expansion
 * resolveViewports(['responsive'])
 * // Returns 4 viewports: mobile, tablet, laptop, desktop (all landscape)
 *
 * // Both orientations
 * resolveViewports(['mobile'], 'both')
 * // Returns 2 viewports: mobile portrait and mobile landscape
 *
 * // Mixed with orientation filtering
 * resolveViewports(['responsive'], 'both')
 * // Returns landscape for all, plus portrait for mobile and tablet only (laptop/desktop skip portrait)
 * ```
 */
export function resolveViewports(
	names: readonly PresetRef[],
	orientation: Orientation = 'landscape',
): ResolvedViewport[] {
	// Expand shorthands and deduplicate
	const expandedNames = new Set<ViewportPresetName>()
	for (const name of names) {
		for (const expanded of expandPresetRef(name)) {
			expandedNames.add(expanded)
		}
	}

	const results: ResolvedViewport[] = []

	for (const name of expandedNames) {
		if (orientation === 'both') {
			// Add portrait if supported
			const portrait = getViewport(name, 'portrait')
			if (portrait) {
				results.push(portrait)
			}
			// Always add landscape
			const landscape = getViewport(name, 'landscape')
			if (landscape) {
				results.push(landscape)
			}
		} else {
			const viewport = getViewport(name, orientation)
			if (viewport) {
				results.push(viewport)
			}
		}
	}

	return results
}

/**
 * Get all preset names in order (mobile to desktop)
 */
export function getAllPresetNames(): ViewportPresetName[] {
	return [
		'mobile',
		'mobile-lg',
		'tablet-sm',
		'tablet',
		'tablet-lg',
		'laptop',
		'laptop-lg',
		'desktop',
		'desktop-lg',
	]
}

/**
 * Get all presets that support portrait orientation
 */
export function getPortraitCapablePresets(): ViewportPresetName[] {
	return getAllPresetNames().filter(supportsPortrait)
}
