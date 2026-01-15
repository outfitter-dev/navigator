/**
 * Color scheme normalization utilities
 *
 * Normalizes user-friendly color scheme inputs to Playwright-compatible values.
 */

export type ColorSchemeInput = 'light' | 'dark' | 'system' | 'no-preference'
export type ColorSchemeOutput = 'light' | 'dark' | 'no-preference'

/**
 * Normalize a color scheme input to a Playwright-compatible value
 *
 * @param scheme - User input color scheme
 * @returns Playwright-compatible color scheme
 *
 * @example
 * normalizeColorScheme('system') // => 'no-preference'
 * normalizeColorScheme('light') // => 'light'
 */
export function normalizeColorScheme(
	scheme: ColorSchemeInput,
): ColorSchemeOutput {
	if (scheme === 'system') {
		return 'no-preference'
	}
	return scheme
}
