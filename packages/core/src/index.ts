/**
 * @outfitter/navigator-core
 *
 * Core types, schemas, and utilities for the Navigator browser control system.
 *
 * Key differences from trails:
 * - `snapshot` action renamed to `snap`
 * - `guided` mode renamed to `paired`
 * - Default port: 9334
 * - Storage: ~/.local/share/navigator/
 */

// Schema - re-export everything from schema barrel
export * from './schema'

// Project detection
export {
	detectProjectRoot,
	getProjectRoot,
	isInProject,
	requireProjectRoot,
} from './project'

// Configuration
export {
	getDefaultConfig,
	getServerUrl,
	loadConfig,
	loadConfigFromPath,
	type BrowserConfig,
	type Config,
	type LoggingConfig,
	type MarkersConfig,
	type ModesConfig,
	type NavigatorConfig,
	type ServerConfig,
	type SessionConfig,
	type ViewportConfig,
} from './config'

// Storage paths
export {
	ensureDir,
	getCacheHome,
	getConfigHome,
	getDataHome,
	getMarkerPath,
	getMarkersDir,
	getMarkerScreenshotsDir,
	getMarkerScreenshotPath,
	getNavigatorCacheDir,
	getNavigatorConfigDir,
	getNavigatorDataDir,
	getProjectDir,
	getSessionDir,
	getSessionMetaPath,
	getSessionPaths,
	getSessionsDir,
	getStepsPath,
	hashProjectPath,
	hashUrl,
	type SessionPaths,
} from './storage'

// Utilities
export {
	parseKeyCombo,
	normalizeColorScheme,
	type KeyCombo,
	type ColorSchemeInput,
	type ColorSchemeOutput,
} from './utils'

// Viewport utilities
export * from './viewport'
