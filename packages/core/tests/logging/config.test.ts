import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	CATEGORIES,
	type LogLevelString,
	configureLogging,
	getLogger,
	isConfigured,
	resetLogging,
} from '../../src/logging'

// Note: All tests use reset: true to ensure clean LogTape state
// This is necessary because LogTape maintains global state that
// must be explicitly reset between test configurations

describe('isConfigured', () => {
	afterEach(async () => {
		await resetLogging()
	})

	test('returns false before configuration', async () => {
		await resetLogging()
		expect(isConfigured()).toBe(false)
	})

	test('returns true after configuration', async () => {
		await configureLogging({ environment: 'test', reset: true })
		expect(isConfigured()).toBe(true)
	})

	test('returns false after reset', async () => {
		await configureLogging({ environment: 'test', reset: true })
		await resetLogging()
		expect(isConfigured()).toBe(false)
	})
})

describe('configureLogging', () => {
	afterEach(async () => {
		await resetLogging()
	})

	describe('basic configuration', () => {
		test('configures successfully with defaults', async () => {
			await configureLogging({ reset: true })
			expect(isConfigured()).toBe(true)
		})

		test('configures with development environment', async () => {
			await configureLogging({ environment: 'development', reset: true })
			expect(isConfigured()).toBe(true)
		})

		test('configures with production environment', async () => {
			await configureLogging({ environment: 'production', reset: true })
			expect(isConfigured()).toBe(true)
		})

		test('configures with test environment', async () => {
			await configureLogging({ environment: 'test', reset: true })
			expect(isConfigured()).toBe(true)
		})
	})

	describe('level option', () => {
		test('accepts debug level', async () => {
			await configureLogging({
				environment: 'test',
				level: 'debug',
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts info level', async () => {
			await configureLogging({
				environment: 'test',
				level: 'info',
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts warning level', async () => {
			await configureLogging({
				environment: 'test',
				level: 'warning',
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts error level', async () => {
			await configureLogging({
				environment: 'test',
				level: 'error',
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts fatal level', async () => {
			await configureLogging({
				environment: 'test',
				level: 'fatal',
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts all valid level strings', async () => {
			const levels: LogLevelString[] = [
				'debug',
				'info',
				'warning',
				'error',
				'fatal',
			]
			for (const level of levels) {
				await configureLogging({ environment: 'test', level, reset: true })
				expect(isConfigured()).toBe(true)
			}
		})
	})

	describe('jsonOutput option', () => {
		test('accepts jsonOutput true', async () => {
			await configureLogging({
				environment: 'development',
				jsonOutput: true,
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts jsonOutput false', async () => {
			await configureLogging({
				environment: 'development',
				jsonOutput: false,
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})
	})

	describe('categories option', () => {
		test('accepts empty categories', async () => {
			await configureLogging({
				environment: 'test',
				categories: {},
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts navigator category overrides', async () => {
			await configureLogging({
				environment: 'test',
				categories: {
					'navigator.server.actions': 'debug',
					'navigator.mcp': 'warning',
				},
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})

		test('accepts multiple navigator category levels', async () => {
			await configureLogging({
				environment: 'test',
				categories: {
					'navigator.server': 'debug',
					'navigator.mcp': 'info',
					'navigator.cli': 'error',
				},
				reset: true,
			})
			expect(isConfigured()).toBe(true)
		})
	})

	describe('reset option', () => {
		test('allows reconfiguration with reset true', async () => {
			await configureLogging({ environment: 'development', reset: true })
			await configureLogging({ environment: 'production', reset: true })
			expect(isConfigured()).toBe(true)
		})

		test('throws without reset when already configured', async () => {
			await configureLogging({ environment: 'development', reset: true })
			await expect(
				configureLogging({ environment: 'production' }),
			).rejects.toThrow('Logging already configured')
		})
	})

	describe('error handling', () => {
		test('throws on double configure without reset', async () => {
			await configureLogging({ environment: 'test', reset: true })
			await expect(configureLogging({ environment: 'test' })).rejects.toThrow()
		})

		test('error message mentions reset option', async () => {
			await configureLogging({ environment: 'test', reset: true })
			await expect(configureLogging({ environment: 'test' })).rejects.toThrow(
				'reset: true',
			)
		})
	})
})

describe('getLogger', () => {
	beforeEach(async () => {
		await configureLogging({ environment: 'test', level: 'debug', reset: true })
	})

	afterEach(async () => {
		await resetLogging()
	})

	describe('returns logger instance', () => {
		test('returns logger for ROOT category', () => {
			const logger = getLogger(CATEGORIES.ROOT)
			expect(logger).toBeDefined()
		})

		test('returns logger for SERVER category', () => {
			const logger = getLogger(CATEGORIES.SERVER)
			expect(logger).toBeDefined()
		})

		test('returns logger for ACTIONS category', () => {
			const logger = getLogger(CATEGORIES.ACTIONS)
			expect(logger).toBeDefined()
		})

		test('returns logger for MCP category', () => {
			const logger = getLogger(CATEGORIES.MCP)
			expect(logger).toBeDefined()
		})

		test('returns logger for CLI category', () => {
			const logger = getLogger(CATEGORIES.CLI)
			expect(logger).toBeDefined()
		})

		test('returns logger for HONO category', () => {
			const logger = getLogger(CATEGORIES.HONO)
			expect(logger).toBeDefined()
		})
	})

	describe('accepts custom category arrays', () => {
		test('returns logger for custom category', () => {
			const logger = getLogger(['navigator', 'custom'])
			expect(logger).toBeDefined()
		})

		test('returns logger for deep custom category', () => {
			const logger = getLogger(['navigator', 'server', 'custom', 'deep'])
			expect(logger).toBeDefined()
		})
	})

	describe('logger interface', () => {
		test('logger has debug method', () => {
			const logger = getLogger(CATEGORIES.ROOT)
			expect(typeof logger.debug).toBe('function')
		})

		test('logger has info method', () => {
			const logger = getLogger(CATEGORIES.ROOT)
			expect(typeof logger.info).toBe('function')
		})

		test('logger has warn method', () => {
			const logger = getLogger(CATEGORIES.ROOT)
			expect(typeof logger.warn).toBe('function')
		})

		test('logger has error method', () => {
			const logger = getLogger(CATEGORIES.ROOT)
			expect(typeof logger.error).toBe('function')
		})

		test('logger has fatal method', () => {
			const logger = getLogger(CATEGORIES.ROOT)
			expect(typeof logger.fatal).toBe('function')
		})
	})
})

describe('resetLogging', () => {
	afterEach(async () => {
		await resetLogging()
	})

	test('resets configuration state', async () => {
		await configureLogging({ environment: 'test', reset: true })
		expect(isConfigured()).toBe(true)
		await resetLogging()
		expect(isConfigured()).toBe(false)
	})

	test('allows reconfiguration after reset', async () => {
		await configureLogging({ environment: 'development', reset: true })
		await resetLogging()
		await configureLogging({ environment: 'production', reset: true })
		expect(isConfigured()).toBe(true)
	})

	test('can be called multiple times', async () => {
		await resetLogging()
		await resetLogging()
		await resetLogging()
		expect(isConfigured()).toBe(false)
	})

	test('can be called without prior configuration', async () => {
		await resetLogging()
		await expect(resetLogging()).resolves.toBeUndefined()
	})
})
