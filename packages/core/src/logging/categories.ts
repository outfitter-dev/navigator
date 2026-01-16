/**
 * Logger category constants
 *
 * Defines the hierarchical category structure for Navigator logging.
 * Categories follow the pattern: ['navigator', '{package}', '{subsystem}']
 *
 * Setting a log level on a parent category (e.g., 'navigator') affects all children.
 *
 * @example
 * ```ts
 * import { getLogger } from '@logtape/logtape'
 * import { CATEGORIES } from '@outfitter/navigator-core/logging'
 *
 * const logger = getLogger(CATEGORIES.ACTIONS)
 * logger.info`Action completed`
 * ```
 */

/**
 * Hierarchical logger categories
 *
 * Category hierarchy:
 * ```
 * navigator                           # Root - inherit to all
 * +-- core                            # Core utilities
 * |   +-- config                      # Config loading
 * +-- server                          # HTTP/WS server
 * |   +-- actions                     # Action execution
 * |   +-- browser                     # Browser manager
 * |   +-- paired                      # Paired mode manager
 * |   +-- session                     # Session management
 * |   +-- markers                     # Marker store
 * |   +-- watch                       # Watch broadcaster
 * +-- mcp                             # MCP server
 * |   +-- tools                       # Tool execution
 * +-- cli                             # CLI (debug only)
 * |   +-- commands                    # Command execution
 * +-- hono                            # Hono middleware (via @logtape/hono)
 * ```
 */
export const CATEGORIES = {
	/** Root category - setting level here affects all Navigator logs */
	ROOT: ['navigator'] as const,

	// Core
	/** Core utilities */
	CORE: ['navigator', 'core'] as const,
	/** Config loading and validation */
	CONFIG: ['navigator', 'core', 'config'] as const,

	// Server
	/** HTTP/WebSocket server */
	SERVER: ['navigator', 'server'] as const,
	/** Action execution */
	ACTIONS: ['navigator', 'server', 'actions'] as const,
	/** Browser manager (headless/windowed/paired) */
	BROWSER: ['navigator', 'server', 'browser'] as const,
	/** Paired mode (extension) manager */
	PAIRED: ['navigator', 'server', 'paired'] as const,
	/** Session management */
	SESSION: ['navigator', 'server', 'session'] as const,
	/** Marker store operations */
	MARKERS: ['navigator', 'server', 'markers'] as const,
	/** Watch broadcast for file changes */
	WATCH: ['navigator', 'server', 'watch'] as const,

	// MCP
	/** MCP server */
	MCP: ['navigator', 'mcp'] as const,
	/** MCP tool execution */
	MCP_TOOLS: ['navigator', 'mcp', 'tools'] as const,

	// CLI (debug only)
	/** CLI application */
	CLI: ['navigator', 'cli'] as const,
	/** CLI command execution */
	CLI_COMMANDS: ['navigator', 'cli', 'commands'] as const,

	// Hono middleware
	/** Hono HTTP request logging (via @logtape/hono) */
	HONO: ['hono'] as const,
} as const

/** Keys of the CATEGORIES object */
export type CategoryKey = keyof typeof CATEGORIES

/** Category tuple type (readonly string array) */
export type Category = (typeof CATEGORIES)[CategoryKey]
