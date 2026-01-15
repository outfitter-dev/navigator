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

				// Handle preset
				if (options?.preset) {
					const presetName = options.preset as ViewportPreset
					if (!(presetName in VIEWPORT_PRESETS)) {
						console.error(
							`Invalid preset: ${options.preset}. Use: mobile, tablet, desktop`,
						)
						process.exitCode = 1
						return
					}

					const preset = VIEWPORT_PRESETS[presetName]
					try {
						await client.execute({
							action: 'viewport',
							width: preset.width,
							height: preset.height,
						})
						console.log(
							`Viewport set to ${presetName}: ${preset.width}x${preset.height}`,
						)
					} catch (error) {
						console.error(
							`Failed to set viewport: ${error instanceof Error ? error.message : String(error)}`,
						)
						process.exitCode = 1
					}
					return
				}

				// Handle explicit dimensions
				if (!widthStr || !heightStr) {
					console.error(
						'Usage: nav viewport <width> <height> or nav viewport --preset <name>',
					)
					process.exitCode = 1
					return
				}

				const width = Number(widthStr)
				const height = Number(heightStr)

				if (Number.isNaN(width) || Number.isNaN(height)) {
					console.error('Width and height must be valid numbers')
					process.exitCode = 1
					return
				}

				try {
					await client.execute({
						action: 'viewport',
						width,
						height,
					})
					console.log(`Viewport set to: ${width}x${height}`)
				} catch (error) {
					console.error(
						`Failed to set viewport: ${error instanceof Error ? error.message : String(error)}`,
					)
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
