/**
 * LogTape sink factories
 *
 * Provides sink factory functions for different logging environments:
 * - Development: Human-readable colored console output
 * - Production: JSON lines output for log aggregation
 * - Debug: File-based logging for debugging
 *
 * @example
 * ```ts
 * import { createDevConsoleSink, createJsonConsoleSink } from '@outfitter/navigator-core/logging'
 *
 * const sink = process.env.NODE_ENV === 'production'
 *   ? createJsonConsoleSink()
 *   : createDevConsoleSink()
 * ```
 */

import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import { Writable } from 'node:stream'

import {
	type LogRecord,
	type Sink,
	type TextFormatter,
	getAnsiColorFormatter,
	getConsoleSink,
	getStreamSink,
} from '@logtape/logtape'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Expand ~ to home directory in file paths.
 */
function expandHomePath(filePath: string): string {
	if (filePath.startsWith('~/')) {
		return filePath.replace('~', homedir())
	}
	if (filePath === '~') {
		return homedir()
	}
	return filePath
}

/**
 * Safely stringify a value for logging.
 * Handles BigInt, circular references, and other non-serializable values.
 */
function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value, (_key, val) =>
			typeof val === 'bigint' ? val.toString() : val,
		)
	} catch {
		return String(value)
	}
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format log message from LogRecord's message array.
 * LogTape stores messages as interleaved template/value arrays.
 */
function formatMessage(message: readonly unknown[]): string {
	return message
		.map((part) =>
			typeof part === 'string' ? part : (safeStringify(part) ?? String(part)),
		)
		.join('')
}

/**
 * JSON formatter for structured logging.
 * Outputs newline-delimited JSON suitable for log aggregation.
 */
const jsonFormatter: TextFormatter = (record: LogRecord): string => {
	const entry = {
		ts: new Date(record.timestamp).toISOString(),
		level: record.level,
		category: record.category.join('.'),
		msg: formatMessage(record.message),
		...record.properties,
	}
	return JSON.stringify(entry)
}

// ============================================================================
// Development Console Sink
// ============================================================================

/**
 * Create a development console sink with colored output.
 *
 * Features:
 * - ANSI color-coded log levels (debug=blue, info=green, warning=yellow, error=red, fatal=magenta)
 * - Compact timestamp format (time only with short timezone)
 * - Dot-separated category hierarchy
 * - Human-readable message formatting
 *
 * @example Output
 * ```
 * 13:45:23.456 +00 [INF] navigator.server: Server starting on http://localhost:9334
 * 13:45:23.789 +00 [DBG] navigator.server.actions: Executing click on @e42
 * ```
 *
 * @returns LogTape sink for console output
 */
export function createDevConsoleSink(): Sink {
	const formatter = getAnsiColorFormatter({
		timestamp: 'time-tz',
		level: 'ABBR',
		category: (cats) => cats.join('.'),
		timestampStyle: 'dim',
		levelStyle: 'bold',
		categoryStyle: 'dim',
		levelColors: {
			trace: null,
			debug: 'cyan',
			info: 'green',
			warning: 'yellow',
			error: 'red',
			fatal: 'magenta',
		},
	})

	return getConsoleSink({ formatter })
}

// ============================================================================
// JSON Console Sink
// ============================================================================

/**
 * Create a JSON console sink for production environments.
 *
 * Features:
 * - Structured JSON output (one object per line)
 * - ISO 8601 timestamps for consistent parsing
 * - All context properties included
 * - Suitable for log aggregation systems (CloudWatch, Datadog, etc.)
 *
 * @example Output
 * ```json
 * {"ts":"2024-01-15T13:45:23.456Z","level":"info","category":"navigator.server","msg":"Server starting on http://localhost:9334"}
 * {"ts":"2024-01-15T13:45:23.789Z","level":"debug","category":"navigator.server.actions","msg":"Executing click on @e42","ref":"e42"}
 * ```
 *
 * @returns LogTape sink for JSON console output
 */
export function createJsonConsoleSink(): Sink {
	return getConsoleSink({ formatter: jsonFormatter })
}

// ============================================================================
// File Sink
// ============================================================================

/**
 * Options for file sink creation.
 */
export interface FileSinkOptions {
	/**
	 * Whether to append to existing file (default: true)
	 */
	append?: boolean
}

/**
 * Create a file sink for logging to disk.
 *
 * Features:
 * - JSON lines format for easy parsing
 * - Auto-creates parent directories
 * - Append mode by default
 * - Returns AsyncDisposable for cleanup
 *
 * @example
 * ```ts
 * const sink = await createFileSink('~/.local/share/navigator/logs/debug.log')
 *
 * // Later, dispose when done
 * await sink[Symbol.asyncDispose]()
 * ```
 *
 * @param filePath - Absolute path to the log file
 * @param options - Sink options
 * @returns Promise resolving to LogTape sink with AsyncDisposable
 * @throws Error if directory creation or file open fails
 */
export async function createFileSink(
	filePath: string,
	options: FileSinkOptions = {},
): Promise<Sink & AsyncDisposable> {
	const { append = true } = options
	const expandedPath = expandHomePath(filePath)

	try {
		// Ensure parent directory exists
		await mkdir(dirname(expandedPath), { recursive: true })

		// Create Node.js write stream
		const nodeStream = createWriteStream(expandedPath, {
			flags: append ? 'a' : 'w',
			encoding: 'utf8',
		})

		// Convert to Web WritableStream for LogTape
		const webStream = Writable.toWeb(nodeStream) as WritableStream<Uint8Array>

		return getStreamSink(webStream, { formatter: jsonFormatter })
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unknown error occurred'
		throw new Error(
			`Failed to create log file sink at '${filePath}': ${message}`,
		)
	}
}

// ============================================================================
// Sink Factory
// ============================================================================

/**
 * Environment type for sink selection.
 */
export type Environment = 'development' | 'production' | 'test'

/**
 * Options for the createSinks factory function.
 */
export interface CreateSinksOptions {
	/**
	 * Runtime environment (determines default output format)
	 */
	environment: Environment

	/**
	 * Force JSON output regardless of environment
	 */
	jsonOutput?: boolean

	/**
	 * Path to log file (enables file logging)
	 */
	logFile?: string
}

/**
 * Collection of configured sinks.
 */
export interface SinkCollection {
	/**
	 * Console sink (always present)
	 */
	console: Sink

	/**
	 * File sink (present if logFile was specified)
	 */
	file?: Sink & AsyncDisposable
}

/**
 * Create sinks based on environment and options.
 *
 * Sink selection logic:
 * - Production or jsonOutput=true: JSON console sink
 * - Development/test: Colored console sink
 * - logFile specified: Additional file sink
 *
 * @example
 * ```ts
 * const sinks = await createSinks({
 *   environment: 'development',
 *   logFile: '/tmp/navigator-debug.log',
 * })
 *
 * // Use in LogTape configure()
 * await configure({
 *   sinks: {
 *     console: sinks.console,
 *     file: sinks.file,
 *   },
 *   // ...
 * })
 * ```
 *
 * @param options - Sink creation options
 * @returns Promise resolving to sink collection
 */
export async function createSinks(
	options: CreateSinksOptions,
): Promise<SinkCollection> {
	const { environment, jsonOutput, logFile } = options

	const sinks: SinkCollection = {
		console:
			environment === 'production' || jsonOutput
				? createJsonConsoleSink()
				: createDevConsoleSink(),
	}

	if (logFile) {
		sinks.file = await createFileSink(logFile)
	}

	return sinks
}
