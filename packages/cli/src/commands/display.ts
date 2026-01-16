/**
 * Display Commands
 *
 * viewport, color-scheme
 */

import {
	type ColorSchemeInput,
	normalizeColorScheme,
} from '@outfitter/navigator-core'
import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

/** Viewport presets with their dimensions */
const VIEWPORT_PRESETS = {
	mobile: { width: 375, height: 667 },
	tablet: { width: 768, height: 1024 },
	desktop: { width: 1920, height: 1080 },
} as const

type ViewportPreset = keyof typeof VIEWPORT_PRESETS
type ViewportDimensions = { width: number; height: number }

/** Format error message from unknown error */
function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** Resolve viewport dimensions from preset name */
function resolvePreset(
	presetName: string,
):
	| { ok: true; dimensions: ViewportDimensions; name: ViewportPreset }
	| { ok: false; error: string } {
	if (!(presetName in VIEWPORT_PRESETS)) {
		return {
			ok: false,
			error: `Invalid preset: ${presetName}. Use: mobile, tablet, desktop`,
		}
	}
	const name = presetName as ViewportPreset
	return { ok: true, dimensions: VIEWPORT_PRESETS[name], name }
}

/** Parse and validate explicit dimensions */
function parseDimensions(
	widthStr?: string,
	heightStr?: string,
): { ok: true; dimensions: ViewportDimensions } | { ok: false; error: string } {
	if (!widthStr || !heightStr) {
		return {
			ok: false,
			error:
				'Usage: nav viewport <width> <height> or nav viewport --preset <name>',
		}
	}

	const width = Number(widthStr)
	const height = Number(heightStr)

	if (Number.isNaN(width) || Number.isNaN(height)) {
		return { ok: false, error: 'Width and height must be valid numbers' }
	}

	return { ok: true, dimensions: { width, height } }
}

export function registerDisplayCommands(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	// nav viewport <width> <height> or nav viewport --preset <name>
	program
		.command('viewport [width] [height]')
		.description('Set viewport size')
		.option('-p, --preset <name>', 'Use preset: mobile, tablet, desktop')
		.action(
			async (
				widthStr?: string,
				heightStr?: string,
				options?: { preset?: string },
			) => {
				const client = getClient()

				// Resolve dimensions from preset or explicit args
				const resolved = options?.preset
					? resolvePreset(options.preset)
					: parseDimensions(widthStr, heightStr)

				if (!resolved.ok) {
					console.error(resolved.error)
					process.exitCode = 1
					return
				}

				const { width, height } = resolved.dimensions
				const label =
					'name' in resolved
						? `${resolved.name}: ${width}x${height}`
						: `${width}x${height}`

				try {
					await client.execute({ action: 'viewport', width, height })
					console.log(`Viewport set to ${label}`)
				} catch (error) {
					console.error(`Failed to set viewport: ${formatError(error)}`)
					process.exitCode = 1
				}
			},
		)

	// nav color-scheme <scheme>
	program
		.command('color-scheme <scheme>')
		.description('Set color scheme: light, dark, system (or no-preference)')
		.action(async (scheme: string) => {
			const client = getClient()

			const validSchemes = ['light', 'dark', 'system', 'no-preference']
			if (!validSchemes.includes(scheme)) {
				console.error(
					`Invalid scheme: ${scheme}. Use: ${validSchemes.join(', ')}`,
				)
				process.exitCode = 1
				return
			}

			// Normalize input (e.g., 'system' -> 'no-preference')
			const normalized = normalizeColorScheme(scheme as ColorSchemeInput)

			try {
				await client.execute({
					action: 'colorScheme',
					scheme: normalized,
				})
				console.log(
					`Color scheme set to: ${scheme}${scheme !== normalized ? ` (${normalized})` : ''}`,
				)
			} catch (error) {
				console.error(
					`Failed to set color scheme: ${error instanceof Error ? error.message : String(error)}`,
				)
				process.exitCode = 1
			}
		})
}
