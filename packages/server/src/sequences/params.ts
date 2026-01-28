/**
 * Variable Interpolation for Sequences
 *
 * Handles {{varName}} parameter substitution in action objects.
 */

import { VARIABLE_PATTERN } from '@outfitter/navigator-core/schema'

/**
 * Check if a string contains variable placeholders.
 */
export function hasVariables(str: string): boolean {
	VARIABLE_PATTERN.lastIndex = 0 // Reset regex state
	return VARIABLE_PATTERN.test(str)
}

/**
 * Extract variable names from a string.
 */
export function extractVariables(str: string): string[] {
	const vars: string[] = []
	VARIABLE_PATTERN.lastIndex = 0
	let match = VARIABLE_PATTERN.exec(str)
	while (match !== null) {
		vars.push(match[1])
		match = VARIABLE_PATTERN.exec(str)
	}
	return vars
}

/**
 * Interpolate variables in a string.
 * Replaces {{varName}} with params[varName].
 * Missing variables are left as-is.
 */
export function interpolateString(
	str: string,
	params: Record<string, unknown>,
): string {
	VARIABLE_PATTERN.lastIndex = 0
	return str.replace(VARIABLE_PATTERN, (match, varName: string) => {
		if (varName in params) {
			const value = params[varName]
			return typeof value === 'string' ? value : String(value)
		}
		return match // Leave unmatched variables as-is
	})
}

/**
 * Recursively interpolate variables in an object or array.
 * Creates a new object/array with interpolated values.
 *
 * Note: When params is empty/undefined, returns the original data reference
 * unchanged (optimization). When params is provided, always returns a new
 * object with interpolated values.
 */
export function interpolateParams<T>(
	data: T,
	params?: Record<string, unknown>,
): T {
	if (!params || Object.keys(params).length === 0) {
		return data
	}

	return interpolateValue(data, params, new WeakSet()) as T
}

/**
 * Internal recursive interpolation with circular reference protection.
 */
function interpolateValue(
	value: unknown,
	params: Record<string, unknown>,
	visited: WeakSet<WeakKey>,
): unknown {
	if (typeof value === 'string') {
		return interpolateString(value, params)
	}

	if (Array.isArray(value)) {
		if (visited.has(value)) {
			return value // Break circular reference
		}
		visited.add(value)
		return value.map((item) => interpolateValue(item, params, visited))
	}

	if (value !== null && typeof value === 'object') {
		if (visited.has(value)) {
			return value // Break circular reference
		}
		visited.add(value)
		const result: Record<string, unknown> = {}
		for (const [key, val] of Object.entries(value)) {
			result[key] = interpolateValue(val, params, visited)
		}
		return result
	}

	// Primitives (number, boolean, null, undefined) pass through unchanged
	return value
}

/**
 * Validate that all required variables are provided.
 * Returns array of missing variable names.
 */
export function validateParams(
	data: unknown,
	params: Record<string, unknown>,
): string[] {
	const missing: string[] = []
	collectMissingVariables(data, params, missing)
	return [...new Set(missing)] // Deduplicate
}

/**
 * Internal recursive variable collection.
 */
function collectMissingVariables(
	value: unknown,
	params: Record<string, unknown>,
	missing: string[],
): void {
	if (typeof value === 'string') {
		for (const varName of extractVariables(value)) {
			if (!(varName in params)) {
				missing.push(varName)
			}
		}
		return
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectMissingVariables(item, params, missing)
		}
		return
	}

	if (value !== null && typeof value === 'object') {
		for (const val of Object.values(value)) {
			collectMissingVariables(val, params, missing)
		}
	}
}
