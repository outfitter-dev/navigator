/**
 * Logging barrel export
 *
 * Re-exports LogTape configuration utilities, category constants,
 * sink factories, and redaction utilities.
 *
 * @example
 * ```ts
 * import {
 *   configureLogging,
 *   getLogger,
 *   CATEGORIES,
 * } from '@outfitter/navigator-core/logging'
 *
 * // Initialize at application startup
 * await configureLogging({
 *   environment: 'development',
 *   level: 'debug',
 * })
 *
 * // Create logger with predefined category
 * const logger = getLogger(CATEGORIES.ACTIONS)
 * logger.info`Action completed`
 * ```
 */

// Configuration
export {
	configureLogging,
	configureMcpLogging,
	getLogger,
	isConfigured,
	resetLogging,
	type LoggingOptions,
	type LogLevelString,
	type McpLoggingOptions,
} from './config'

// Categories
export {
	CATEGORIES,
	type Category,
	type CategoryKey,
} from './categories'

// Sinks
export {
	createDevConsoleSink,
	createFileSink,
	createJsonConsoleSink,
	createJsonStderrSink,
	createSinks,
	createStderrSink,
	type CreateSinksOptions,
	type Environment,
	type FileSinkOptions,
	type SinkCollection,
} from './sinks'

// Redaction
export {
	isSensitiveField,
	REDACTED,
	REDACTION_RULES,
	redactRecord,
	redactValue,
	SENSITIVE_FIELDS,
	SENSITIVE_PATTERNS,
	type RedactOptions,
	type RedactionRules,
} from './redact'
