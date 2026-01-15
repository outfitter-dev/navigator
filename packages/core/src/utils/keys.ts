/**
 * Key combo parsing utilities
 *
 * Parses keyboard shortcut strings like "ctrl-k" or "cmd+shift+p"
 * into structured KeyCombo objects for use with Playwright.
 */

export interface KeyCombo {
	key: string
	modifiers: string[]
}

/**
 * Parse a key combo string into its components
 *
 * @param combo - Key combo string like "ctrl-k", "cmd+shift+p", "Enter"
 * @returns Parsed KeyCombo with key and modifiers
 *
 * @example
 * parseKeyCombo('Enter') // => { key: 'Enter', modifiers: [] }
 * parseKeyCombo('ctrl-k') // => { key: 'k', modifiers: ['Control'] }
 * parseKeyCombo('cmd-shift-p') // => { key: 'p', modifiers: ['Meta', 'Shift'] }
 */
// Modifier key normalization map (lowercase input -> Playwright modifier)
const modifierMap: Record<string, string> = {
	cmd: 'Meta',
	meta: 'Meta',
	win: 'Meta',
	ctrl: 'Control',
	control: 'Control',
	alt: 'Alt',
	option: 'Alt',
	shift: 'Shift',
}

// Key normalization map (lowercase input -> Playwright key)
const keyMap: Record<string, string> = {
	esc: 'Escape',
}

export function parseKeyCombo(combo: string): KeyCombo {
	// Split by either - or + (supports both ctrl-k and ctrl+k)
	const parts = combo.split(/[-+]/)

	// Last part is the key, everything before is modifiers
	// split() always returns at least one element for non-empty strings
	const rawKey = parts.at(-1) ?? combo
	const rawModifiers = parts.slice(0, -1)

	// Normalize the key
	const normalizedKey = keyMap[rawKey.toLowerCase()] ?? rawKey

	// Normalize and filter modifiers
	const modifiers = rawModifiers
		.map((mod) => modifierMap[mod.toLowerCase()])
		.filter((mod): mod is string => mod !== undefined)

	return {
		key: normalizedKey,
		modifiers,
	}
}
