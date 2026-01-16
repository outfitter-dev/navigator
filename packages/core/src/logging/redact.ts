/**
 * Sensitive data redaction utilities
 *
 * Provides field-based and pattern-based redaction for log data.
 * Used to prevent sensitive information from appearing in logs.
 *
 * @example
 * ```ts
 * import { redactRecord } from '@outfitter/navigator-core/logging'
 *
 * const sanitized = redactRecord({
 *   user: 'john',
 *   password: 'secret123',
 *   token: 'Bearer eyJhbGciOiJIUzI1NiIs...',
 * })
 * // => { user: 'john', password: '[REDACTED]', token: '[REDACTED]' }
 * ```
 */

// ============================================================================
// Constants
// ============================================================================

/** Placeholder text for redacted values */
export const REDACTED = '[REDACTED]'

/**
 * Field names that should always be redacted (case-insensitive matching)
 *
 * Common sensitive field names across APIs and configurations.
 */
export const SENSITIVE_FIELDS: readonly string[] = [
	'password',
	'token',
	'secret',
	'key',
	'authorization',
	'cookie',
	'credentials',
	'apiKey',
	'api_key',
	'apikey',
	'accessToken',
	'access_token',
	'refreshToken',
	'refresh_token',
	'privateKey',
	'private_key',
	'sessionId',
	'session_id',
] as const

/**
 * Patterns that indicate sensitive data in string values
 *
 * These patterns match common token/key formats even when
 * the field name isn't explicitly marked as sensitive.
 */
export const SENSITIVE_PATTERNS: readonly RegExp[] = [
	// Bearer tokens (Authorization header value)
	/Bearer\s+[\w\-._~+/]+=*/gi,
	// Basic auth (Authorization header value)
	/Basic\s+[A-Za-z0-9+/]+=*/gi,
	// JWT patterns (three base64url segments separated by dots)
	/eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
	// OpenAI-style API keys
	/sk-[a-zA-Z0-9]{20,}/g,
	// Slack tokens
	/xox[baprs]-[a-zA-Z0-9-]+/g,
	// GitHub tokens
	/gh[pousr]_[A-Za-z0-9_]{36,}/g,
	// AWS access keys
	/AKIA[0-9A-Z]{16}/g,
] as const

/**
 * Redaction rules configuration
 *
 * Combines field names and patterns into a single configuration object.
 * Used by logging configuration and custom sinks.
 */
export const REDACTION_RULES = {
	/** Field names to redact (case-insensitive) */
	fields: SENSITIVE_FIELDS,
	/** Patterns to match in string values */
	patterns: SENSITIVE_PATTERNS,
} as const

/** Type for redaction rules configuration */
export type RedactionRules = typeof REDACTION_RULES

// ============================================================================
// Type Definitions
// ============================================================================

/** Options for redaction functions */
export interface RedactOptions {
	/** Additional field names to redact */
	additionalFields?: readonly string[] | undefined
	/** Additional patterns to match */
	additionalPatterns?: readonly RegExp[] | undefined
	/** Custom redaction placeholder (default: '[REDACTED]') */
	placeholder?: string | undefined
}

// ============================================================================
// Field Name Matching
// ============================================================================

/**
 * Normalized set of sensitive field names for O(1) lookup
 */
const sensitiveFieldSet = new Set(SENSITIVE_FIELDS.map((f) => f.toLowerCase()))

/**
 * Check if a field name should be redacted
 *
 * @param fieldName - The field name to check
 * @param additionalFields - Optional additional field names to check
 * @returns True if the field should be redacted
 *
 * @example
 * ```ts
 * isSensitiveField('password')     // => true
 * isSensitiveField('apiKey')       // => true
 * isSensitiveField('username')     // => false
 * isSensitiveField('custom', ['custom']) // => true
 * ```
 */
export function isSensitiveField(
	fieldName: string,
	additionalFields?: readonly string[],
): boolean {
	const normalized = fieldName.toLowerCase()

	if (sensitiveFieldSet.has(normalized)) {
		return true
	}

	if (additionalFields) {
		return additionalFields.some((f) => f.toLowerCase() === normalized)
	}

	return false
}

// ============================================================================
// Value Redaction
// ============================================================================

/**
 * Check if a string value contains sensitive patterns
 *
 * @param value - The string value to check
 * @param additionalPatterns - Optional additional patterns to check
 * @returns True if the value matches any sensitive pattern
 */
function containsSensitivePattern(
	value: string,
	additionalPatterns?: readonly RegExp[],
): boolean {
	for (const pattern of SENSITIVE_PATTERNS) {
		// Reset lastIndex for global patterns
		pattern.lastIndex = 0
		if (pattern.test(value)) {
			return true
		}
	}

	if (additionalPatterns) {
		for (const pattern of additionalPatterns) {
			// Reset lastIndex for global patterns
			if (pattern.global) {
				pattern.lastIndex = 0
			}
			if (pattern.test(value)) {
				return true
			}
		}
	}

	return false
}

/**
 * Redact a single value based on its type and content
 *
 * For strings, checks against sensitive patterns.
 * For other types, returns the value unchanged.
 * Does NOT check field names - use redactRecord for field-based redaction.
 *
 * @param value - The value to potentially redact
 * @param options - Redaction options
 * @returns The original value or '[REDACTED]' placeholder
 *
 * @example
 * ```ts
 * redactValue('Bearer eyJhbGciOiJIUzI1NiIs...')
 * // => '[REDACTED]'
 *
 * redactValue('hello world')
 * // => 'hello world'
 *
 * redactValue(12345)
 * // => 12345
 * ```
 */
export function redactValue(value: unknown, options?: RedactOptions): unknown {
	const placeholder = options?.placeholder ?? REDACTED

	// Only check patterns for strings
	if (typeof value === 'string') {
		if (containsSensitivePattern(value, options?.additionalPatterns)) {
			return placeholder
		}
	}

	return value
}

// ============================================================================
// Record Redaction
// ============================================================================

/**
 * Recursively redact sensitive fields from an object
 *
 * Walks through the object tree and redacts:
 * 1. Fields with sensitive names (password, token, etc.)
 * 2. String values matching sensitive patterns (JWT, API keys, etc.)
 *
 * @param record - The object to redact
 * @param options - Redaction options
 * @returns A new object with sensitive data redacted
 *
 * @example
 * ```ts
 * const input = {
 *   user: 'john',
 *   password: 'secret123',
 *   headers: {
 *     authorization: 'Bearer eyJ...',
 *   },
 *   data: {
 *     message: 'Contains sk-abc123xyz sensitive key',
 *   },
 * }
 *
 * redactRecord(input)
 * // => {
 * //   user: 'john',
 * //   password: '[REDACTED]',
 * //   headers: {
 * //     authorization: '[REDACTED]',
 * //   },
 * //   data: {
 * //     message: '[REDACTED]',
 * //   },
 * // }
 * ```
 */
export function redactRecord<T extends Record<string, unknown>>(
	record: T,
	options?: RedactOptions,
): T {
	const placeholder = options?.placeholder ?? REDACTED
	const additionalFields = options?.additionalFields
	const additionalPatterns = options?.additionalPatterns

	function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(obj)) {
			// Check if field name is sensitive
			if (isSensitiveField(key, additionalFields)) {
				result[key] = placeholder
				continue
			}

			// Recursively process nested objects
			if (value !== null && typeof value === 'object') {
				if (Array.isArray(value)) {
					result[key] = value.map((item) => {
						if (item !== null && typeof item === 'object') {
							return redactObject(item as Record<string, unknown>)
						}
						return redactValue(item, { additionalPatterns, placeholder })
					})
				} else {
					result[key] = redactObject(value as Record<string, unknown>)
				}
				continue
			}

			// Check string values for sensitive patterns
			result[key] = redactValue(value, { additionalPatterns, placeholder })
		}

		return result
	}

	return redactObject(record) as T
}
