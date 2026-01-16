import { afterEach, describe, expect, test } from 'bun:test'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	type Environment,
	createDevConsoleSink,
	createFileSink,
	createJsonConsoleSink,
	createSinks,
} from '../../src/logging/sinks'

describe('createDevConsoleSink', () => {
	test('returns a function', () => {
		const sink = createDevConsoleSink()
		expect(typeof sink).toBe('function')
	})

	test('returned sink is callable', () => {
		const sink = createDevConsoleSink()
		expect(() => {
			// Verify it's a valid sink function (has expected signature)
			expect(sink.length).toBe(1)
		}).not.toThrow()
	})
})

describe('createJsonConsoleSink', () => {
	test('returns a function', () => {
		const sink = createJsonConsoleSink()
		expect(typeof sink).toBe('function')
	})

	test('returned sink is callable', () => {
		const sink = createJsonConsoleSink()
		expect(() => {
			// Verify it's a valid sink function (has expected signature)
			expect(sink.length).toBe(1)
		}).not.toThrow()
	})
})

describe('createFileSink', () => {
	const testFilePath = join(tmpdir(), `navigator-test-${Date.now()}.log`)

	afterEach(async () => {
		try {
			await unlink(testFilePath)
		} catch {
			// Ignore if file doesn't exist
		}
	})

	test('returns a sink function', async () => {
		const sink = await createFileSink(testFilePath)
		expect(typeof sink).toBe('function')
		await sink[Symbol.asyncDispose]()
	})

	test('sink is async disposable', async () => {
		const sink = await createFileSink(testFilePath)
		expect(Symbol.asyncDispose in sink).toBe(true)
		expect(typeof sink[Symbol.asyncDispose]).toBe('function')
		await sink[Symbol.asyncDispose]()
	})

	test('creates parent directories', async () => {
		const nestedPath = join(
			tmpdir(),
			`navigator-test-${Date.now()}`,
			'nested',
			'log.log',
		)
		const sink = await createFileSink(nestedPath)
		expect(typeof sink).toBe('function')
		await sink[Symbol.asyncDispose]()
		// Cleanup
		try {
			await unlink(nestedPath)
		} catch {
			// Ignore
		}
	})
})

describe('createSinks', () => {
	describe('environment-based sink selection', () => {
		test('returns console sink for development', async () => {
			const sinks = await createSinks({ environment: 'development' })
			expect(sinks.console).toBeDefined()
			expect(typeof sinks.console).toBe('function')
		})

		test('returns console sink for production', async () => {
			const sinks = await createSinks({ environment: 'production' })
			expect(sinks.console).toBeDefined()
			expect(typeof sinks.console).toBe('function')
		})

		test('returns console sink for test', async () => {
			const sinks = await createSinks({ environment: 'test' })
			expect(sinks.console).toBeDefined()
			expect(typeof sinks.console).toBe('function')
		})

		test('always includes console sink', async () => {
			const environments: Environment[] = ['development', 'production', 'test']
			for (const environment of environments) {
				const sinks = await createSinks({ environment })
				expect(sinks.console).toBeDefined()
			}
		})
	})

	describe('jsonOutput option', () => {
		test('accepts jsonOutput true in development', async () => {
			const sinks = await createSinks({
				environment: 'development',
				jsonOutput: true,
			})
			expect(sinks.console).toBeDefined()
		})

		test('accepts jsonOutput false in production', async () => {
			const sinks = await createSinks({
				environment: 'production',
				jsonOutput: false,
			})
			expect(sinks.console).toBeDefined()
		})
	})

	describe('logFile option', () => {
		const testFilePath = join(
			tmpdir(),
			`navigator-sinks-test-${Date.now()}.log`,
		)

		afterEach(async () => {
			try {
				await unlink(testFilePath)
			} catch {
				// Ignore
			}
		})

		test('includes file sink when logFile specified', async () => {
			const sinks = await createSinks({
				environment: 'development',
				logFile: testFilePath,
			})
			expect(sinks.file).toBeDefined()
			expect(typeof sinks.file).toBe('function')
			await sinks.file?.[Symbol.asyncDispose]()
		})

		test('file sink is absent when logFile not specified', async () => {
			const sinks = await createSinks({ environment: 'development' })
			expect(sinks.file).toBeUndefined()
		})

		test('file sink is async disposable', async () => {
			const sinks = await createSinks({
				environment: 'development',
				logFile: testFilePath,
			})
			expect(sinks.file).toBeDefined()
			expect(sinks.file && Symbol.asyncDispose in sinks.file).toBe(true)
			await sinks.file?.[Symbol.asyncDispose]()
		})
	})

	describe('sink collection structure', () => {
		test('returns SinkCollection object', async () => {
			const sinks = await createSinks({ environment: 'development' })
			expect(typeof sinks).toBe('object')
			expect('console' in sinks).toBe(true)
		})

		test('console sink is always present', async () => {
			const sinks = await createSinks({ environment: 'test' })
			expect(sinks.console).toBeDefined()
		})
	})
})
