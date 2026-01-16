/**
 * LogTape configuration utilities
 *
 * Provides centralized logging configuration for Navigator packages.
 * Each package's entrypoint calls `configureLogging()` once at startup,
 * then uses `getLogger()` to create loggers for specific categories.
 *
 * @example
 * ```ts
 * // At application startup (e.g., server/src/index.ts)
 * import { configureLogging, getLogger } from '@outfitter/navigator-core/logging'
 *
 * await configureLogging({
 *   environment: 'development',
 *   level: 'debug',
 * })
 *
 * const logger = getLogger(['navigator', 'server'])
 * logger.info`Server started on port 9334`
 * ```
 */

import {
	type LogLevel,
	type Logger,
	configure,
	getLogger as getLogtapeLogger,
} from '@logtape/logtape'

import type { Category } from './categories'
import {
	type Environment,
	createJsonStderrSink,
	createSinks,
	createStderrSink,
} from './sinks'

// ============================================================================
// Types
// ============================================================================

/**
 * Log level strings supported by LogTape.
 */
export type LogLevelString = 'debug' | 'info' | 'warning' | 'error' | 'fatal'

/**
 * Options for configuring the logging system.
 */
export interface LoggingOptions {
	/**
	 * Runtime environment (determines default output format and levels).
	 * @default 'development'
	 */
	environment?: Environment

	/**
	 * Root log level for Navigator loggers.
	 * Can be overridden per-category via `categories` option.
	 * @default 'debug' in development, 'info' in production, 'warning' in test
	 */
	level?: LogLevelString

	/**
	 * Force JSON output regardless of environment.
	 * @default false (uses text format in development)
	 */
	jsonOutput?: boolean

	/**
	 * Path to log file (enables file logging in addition to console).
	 */
	logFile?: string

	/**
	 * Per-category log level overrides.
	 * Keys should be dot-separated category paths (e.g., 'navigator.server.actions').
	 *
	 * @example
	 * ```ts
	 * {
	 *   'navigator.server.actions': 'debug',
	 *   'hono': 'warning',
	 * }
	 * ```
	 */
	categories?: Record<string, LogLevelString>

	/**
	 * Reset existing configuration before applying new one.
	 * Required when reconfiguring in tests or when switching modes.
	 * @default false
	 */
	reset?: boolean
}

// ============================================================================
// Default Log Levels by Environment
// ============================================================================

/**
 * Default log levels by environment.
 *
 * - development: Debug level for detailed diagnostics
 * - production: Info level for normal operations
 * - test: Warning level to reduce noise in test output
 */
const DEFAULT_LEVELS: Record<Environment, LogLevelString> = {
	development: 'debug',
	production: 'info',
	test: 'warning',
}

/**
 * Default category-specific levels applied in all environments.
 * These suppress noisy internal loggers.
 */
const DEFAULT_CATEGORY_LEVELS: Record<string, LogLevelString> = {
	// Suppress LogTape's internal meta-logging unless errors
	'logtape.meta': 'error',
}

// ============================================================================
// Configuration State
// ============================================================================

/**
 * Track whether logging has been configured.
 * Prevents accidental double-configuration.
 */
let configured = false

/**
 * Check if logging has been configured.
 */
export function isConfigured(): boolean {
	return configured
}

// ============================================================================
// Configuration Function
// ============================================================================

/**
 * Configure the LogTape logging system.
 *
 * Call this once at application startup before creating any loggers.
 * Subsequent calls will throw unless `reset: true` is passed.
 *
 * @param options - Configuration options
 * @throws Error if already configured and reset is not true
 * @throws Error if LogTape configuration fails
 *
 * @example
 * ```ts
 * // Development setup
 * await configureLogging({
 *   environment: 'development',
 *   level: 'debug',
 * })
 *
 * // Production setup
 * await configureLogging({
 *   environment: 'production',
 *   logFile: '/var/log/navigator/server.log',
 * })
 *
 * // Test setup with reset
 * await configureLogging({
 *   environment: 'test',
 *   reset: true,
 * })
 * ```
 */
export async function configureLogging(
	options: LoggingOptions = {},
): Promise<void> {
	const {
		environment = 'development',
		level,
		jsonOutput = false,
		logFile,
		categories = {},
		reset = false,
	} = options

	// Prevent double-configuration unless reset is requested
	if (configured && !reset) {
		throw new Error(
			'Logging already configured. Pass reset: true to reconfigure.',
		)
	}

	// Determine effective log level
	const effectiveLevel = level ?? DEFAULT_LEVELS[environment]

	// Create sinks based on environment
	const sinks = await createSinks({
		environment,
		jsonOutput,
		...(logFile !== undefined ? { logFile } : {}),
	})

	// Build sink names for logger configuration
	const sinkNames = ['console']
	if (sinks.file) {
		sinkNames.push('file')
	}

	// Build logger configurations
	const loggers: Array<{
		category: string[]
		lowestLevel: LogLevel
		sinks: string[]
	}> = []

	// Root Navigator logger
	loggers.push({
		category: ['navigator'],
		lowestLevel: effectiveLevel,
		sinks: [...sinkNames],
	})

	// Hono logger (for @logtape/hono middleware)
	loggers.push({
		category: ['hono'],
		lowestLevel: effectiveLevel,
		sinks: [...sinkNames],
	})

	// Apply default category overrides
	for (const [categoryPath, categoryLevel] of Object.entries(
		DEFAULT_CATEGORY_LEVELS,
	)) {
		loggers.push({
			category: categoryPath.split('.'),
			lowestLevel: categoryLevel,
			sinks: [...sinkNames],
		})
	}

	// Apply user-specified category overrides
	for (const [categoryPath, categoryLevel] of Object.entries(categories)) {
		loggers.push({
			category: categoryPath.split('.'),
			lowestLevel: categoryLevel,
			sinks: [...sinkNames],
		})
	}

	// Configure LogTape
	try {
		await configure({
			reset,
			sinks: {
				console: sinks.console,
				...(sinks.file ? { file: sinks.file } : {}),
			},
			loggers,
		})
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unknown error occurred'
		throw new Error(`Failed to configure logging: ${message}`)
	}

	configured = true
}

// ============================================================================
// MCP-Specific Configuration
// ============================================================================

/**
 * Options for MCP logging configuration.
 */
export interface McpLoggingOptions {
	/**
	 * Log level for MCP loggers.
	 * @default 'info'
	 */
	level?: LogLevelString

	/**
	 * Use JSON format instead of colored text.
	 * @default false
	 */
	jsonOutput?: boolean

	/**
	 * Reset existing configuration before applying new one.
	 * @default false
	 */
	reset?: boolean
}

/**
 * Configure logging for MCP servers.
 *
 * MCP servers communicate via stdout (JSON-RPC protocol), so ALL logging
 * MUST go to stderr. This function configures LogTape to use stderr-only
 * sinks, ensuring no log output corrupts the MCP protocol stream.
 *
 * @param options - Configuration options
 * @throws Error if already configured and reset is not true
 *
 * @example
 * ```ts
 * // At MCP server startup
 * import { configureMcpLogging, getLogger, CATEGORIES } from '@outfitter/navigator-core/logging'
 *
 * await configureMcpLogging({ level: 'debug' })
 *
 * const logger = getLogger(CATEGORIES.MCP)
 * logger.info`MCP server started`
 * ```
 */
export async function configureMcpLogging(
	options: McpLoggingOptions = {},
): Promise<void> {
	const { level = 'info', jsonOutput = false, reset = false } = options

	// Prevent double-configuration unless reset is requested
	if (configured && !reset) {
		throw new Error(
			'Logging already configured. Pass reset: true to reconfigure.',
		)
	}

	// Create stderr sink (never stdout for MCP)
	const stderrSink = jsonOutput ? createJsonStderrSink() : createStderrSink()

	// Build logger configurations
	const loggers: Array<{
		category: string[]
		lowestLevel: LogLevel
		sinks: string[]
	}> = [
		// Root Navigator logger
		{
			category: ['navigator'],
			lowestLevel: level,
			sinks: ['stderr'],
		},
		// Suppress LogTape meta-logging unless errors
		{
			category: ['logtape', 'meta'],
			lowestLevel: 'error',
			sinks: ['stderr'],
		},
	]

	// Configure LogTape with stderr-only sink
	try {
		await configure({
			reset,
			sinks: {
				stderr: stderrSink,
			},
			loggers,
		})
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unknown error occurred'
		throw new Error(`Failed to configure MCP logging: ${message}`)
	}

	configured = true
}

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Get a logger for a specific category.
 *
 * Categories should be arrays of strings forming a hierarchy.
 * Use constants from `CATEGORIES` for consistency.
 *
 * @param category - Category as string array or predefined Category tuple
 * @returns LogTape Logger instance
 *
 * @example
 * ```ts
 * import { getLogger, CATEGORIES } from '@outfitter/navigator-core/logging'
 *
 * // Using predefined category
 * const logger = getLogger(CATEGORIES.ACTIONS)
 *
 * // Using custom category array
 * const customLogger = getLogger(['navigator', 'server', 'custom'])
 *
 * // Logging
 * logger.debug`Processing action: ${action.type}`
 * logger.info`Action completed in ${duration}ms`
 * logger.error`Action failed: ${error.message}`
 * ```
 */
export function getLogger(category: Category | readonly string[]): Logger {
	return getLogtapeLogger(category)
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Reset logging configuration.
 *
 * Primarily for testing - resets the configuration state and LogTape.
 * After calling this, `configureLogging()` can be called again.
 */
export async function resetLogging(): Promise<void> {
	await configure({ reset: true, sinks: {}, loggers: [] })
	configured = false
}
