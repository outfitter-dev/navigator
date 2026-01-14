/**
 * Navigator HTTP Client
 *
 * Sends actions to the navigator-server via HTTP.
 */

import { loadConfig } from '@outfitter/navigator-core/config'
import { detectProjectRoot } from '@outfitter/navigator-core/project'
import { type Action, ActionSchema } from '@outfitter/navigator-core/schema'

// ============================================================================
// Types
// ============================================================================

export interface ClientOptions {
	/** Server port override */
	port?: string | undefined
	/** Session ID to use */
	session?: string | undefined
	/** Project root path override */
	project?: string | undefined
}

export interface NavigatorClient {
	/** Execute an action and return the result */
	execute<T = unknown>(action: Action): Promise<T>
	/** Get the server URL */
	serverUrl: string
	/** Get the project path */
	projectPath: string
}

// ============================================================================
// Client Factory
// ============================================================================

/**
 * Create a Navigator HTTP client.
 */
export function createClient(options: ClientOptions = {}): NavigatorClient {
	const port = options.port ?? resolvePort()
	const serverUrl = `http://localhost:${port}`
	const projectPath = options.project ?? detectProjectRoot() ?? process.cwd()

	return {
		serverUrl,
		projectPath,

		async execute<T = unknown>(action: Action): Promise<T> {
			// Validate action before sending
			const validated = ActionSchema.parse(action)

			const response = await fetch(`${serverUrl}/action`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Project-Path': projectPath,
					...(options.session && { 'X-Session-Id': options.session }),
				},
				body: JSON.stringify(validated),
			})

			const result = (await response.json()) as
				| T
				| { error: string; message?: string }

			if (!response.ok) {
				const errorResult = result as { error?: string; message?: string }
				throw new Error(
					errorResult.message ?? errorResult.error ?? 'Action failed',
				)
			}

			return result as T
		},
	}
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the server port from config or default.
 */
function resolvePort(): string {
	try {
		const config = loadConfig()
		return String(config.server.port)
	} catch {
		return '9334'
	}
}
