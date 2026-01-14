/**
 * Configuration Loader
 *
 * Loads Navigator configuration from YAML files.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { getNavigatorConfigDir } from '../storage/paths'

// ============================================================================
// Config Schema
// ============================================================================

const ViewportConfigSchema = z.object({
	width: z.number().default(1280),
	height: z.number().default(720),
	deviceScaleFactor: z.number().optional(),
})

const ServerConfigSchema = z.object({
	port: z.number().default(9334),
	host: z.string().default('localhost'),
})

const BrowserConfigSchema = z.object({
	headless: z.boolean().default(true),
	defaultViewport: ViewportConfigSchema.default({}),
})

const SessionConfigSchema = z.object({
	continuationWindow: z.number().default(30), // minutes
})

const MarkersConfigSchema = z.object({
	includeScreenshot: z.boolean().default(true),
	screenshotSize: z.number().default(100), // px around point markers
})

const ModesConfigSchema = z.object({
	default: z.enum(['headless', 'windowed', 'paired']).default('headless'),
})

const ConfigSchema = z.object({
	server: ServerConfigSchema.default({}),
	browser: BrowserConfigSchema.default({}),
	session: SessionConfigSchema.default({}),
	markers: MarkersConfigSchema.default({}),
	modes: ModesConfigSchema.default({}),
})

export type Config = z.infer<typeof ConfigSchema>
export type ServerConfig = z.infer<typeof ServerConfigSchema>
export type BrowserConfig = z.infer<typeof BrowserConfigSchema>
export type SessionConfig = z.infer<typeof SessionConfigSchema>
export type MarkersConfig = z.infer<typeof MarkersConfigSchema>
export type ModesConfig = z.infer<typeof ModesConfigSchema>
export type ViewportConfig = z.infer<typeof ViewportConfigSchema>

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load configuration from the default config file.
 *
 * Searches for config.yaml in these directories (first existing wins):
 * 1. $XDG_CONFIG_HOME/navigator/ (if XDG_CONFIG_HOME is set)
 * 2. ~/.config/navigator/
 * 3. ~/.navigator/
 *
 * Returns default config if no config file is found.
 *
 * @returns Parsed and validated configuration
 */
export function loadConfig(): Config {
	const configPath = join(getNavigatorConfigDir(), 'config.yaml')

	if (!existsSync(configPath)) {
		return ConfigSchema.parse({})
	}

	try {
		const raw = readFileSync(configPath, 'utf-8')
		const parsed = parse(raw)
		return ConfigSchema.parse(parsed)
	} catch (error) {
		// If parsing fails, return defaults
		console.warn(`Failed to parse config at ${configPath}:`, error)
		return ConfigSchema.parse({})
	}
}

/**
 * Load configuration from a specific file path.
 *
 * @param configPath - Path to config file
 * @returns Parsed and validated configuration
 * @throws Error if file doesn't exist or is invalid
 */
export function loadConfigFromPath(configPath: string): Config {
	if (!existsSync(configPath)) {
		throw new Error(`Config file not found: ${configPath}`)
	}

	const raw = readFileSync(configPath, 'utf-8')
	const parsed = parse(raw)
	return ConfigSchema.parse(parsed)
}

// ============================================================================
// Default Config
// ============================================================================

/**
 * Get the default configuration without loading from disk.
 */
export function getDefaultConfig(): Config {
	return ConfigSchema.parse({})
}
