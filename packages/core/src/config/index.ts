/**
 * Config barrel export
 *
 * Re-exports configuration types and loader utilities.
 */

export {
	getDefaultConfig,
	loadConfig,
	loadConfigFromPath,
	type BrowserConfig,
	type Config,
	type MarkersConfig,
	type ModesConfig,
	type ServerConfig,
	type SessionConfig,
	type ViewportConfig,
} from './loader'

// Keep NavigatorConfig as alias for backward compatibility
export type { Config as NavigatorConfig } from './loader'

import { type Config, loadConfig } from './loader'

/**
 * Get the server URL from config.
 *
 * @param config - Config object (loads from disk if not provided)
 * @returns Server URL string (e.g., "http://localhost:9334")
 */
export function getServerUrl(config?: Config): string {
	const cfg = config ?? loadConfig()
	return `http://${cfg.server.host}:${cfg.server.port}`
}
