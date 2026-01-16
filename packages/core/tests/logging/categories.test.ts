import { describe, expect, test } from 'bun:test'
import {
	CATEGORIES,
	type Category,
	type CategoryKey,
} from '../../src/logging/categories'

describe('CATEGORIES', () => {
	describe('structure', () => {
		test('has ROOT category', () => {
			expect(CATEGORIES.ROOT).toBeDefined()
		})

		test('has CORE category', () => {
			expect(CATEGORIES.CORE).toBeDefined()
		})

		test('has CONFIG category', () => {
			expect(CATEGORIES.CONFIG).toBeDefined()
		})

		test('has SERVER category', () => {
			expect(CATEGORIES.SERVER).toBeDefined()
		})

		test('has ACTIONS category', () => {
			expect(CATEGORIES.ACTIONS).toBeDefined()
		})

		test('has BROWSER category', () => {
			expect(CATEGORIES.BROWSER).toBeDefined()
		})

		test('has PAIRED category', () => {
			expect(CATEGORIES.PAIRED).toBeDefined()
		})

		test('has SESSION category', () => {
			expect(CATEGORIES.SESSION).toBeDefined()
		})

		test('has MARKERS category', () => {
			expect(CATEGORIES.MARKERS).toBeDefined()
		})

		test('has WATCH category', () => {
			expect(CATEGORIES.WATCH).toBeDefined()
		})

		test('has MCP category', () => {
			expect(CATEGORIES.MCP).toBeDefined()
		})

		test('has MCP_TOOLS category', () => {
			expect(CATEGORIES.MCP_TOOLS).toBeDefined()
		})

		test('has CLI category', () => {
			expect(CATEGORIES.CLI).toBeDefined()
		})

		test('has CLI_COMMANDS category', () => {
			expect(CATEGORIES.CLI_COMMANDS).toBeDefined()
		})

		test('has HONO category', () => {
			expect(CATEGORIES.HONO).toBeDefined()
		})
	})

	describe('category values', () => {
		test('ROOT is navigator array', () => {
			expect(CATEGORIES.ROOT).toEqual(['navigator'])
		})

		test('CORE is navigator.core hierarchy', () => {
			expect(CATEGORIES.CORE).toEqual(['navigator', 'core'])
		})

		test('CONFIG is navigator.core.config hierarchy', () => {
			expect(CATEGORIES.CONFIG).toEqual(['navigator', 'core', 'config'])
		})

		test('SERVER is navigator.server hierarchy', () => {
			expect(CATEGORIES.SERVER).toEqual(['navigator', 'server'])
		})

		test('ACTIONS is navigator.server.actions hierarchy', () => {
			expect(CATEGORIES.ACTIONS).toEqual(['navigator', 'server', 'actions'])
		})

		test('MCP is navigator.mcp hierarchy', () => {
			expect(CATEGORIES.MCP).toEqual(['navigator', 'mcp'])
		})

		test('MCP_TOOLS is navigator.mcp.tools hierarchy', () => {
			expect(CATEGORIES.MCP_TOOLS).toEqual(['navigator', 'mcp', 'tools'])
		})

		test('CLI is navigator.cli hierarchy', () => {
			expect(CATEGORIES.CLI).toEqual(['navigator', 'cli'])
		})

		test('HONO is hono hierarchy (not under navigator)', () => {
			expect(CATEGORIES.HONO).toEqual(['hono'])
		})
	})

	describe('category values are readonly string arrays', () => {
		test('all categories are arrays', () => {
			for (const [key, value] of Object.entries(CATEGORIES)) {
				expect(Array.isArray(value)).toBe(true)
			}
		})

		test('all category elements are strings', () => {
			for (const [key, value] of Object.entries(CATEGORIES)) {
				for (const element of value) {
					expect(typeof element).toBe('string')
				}
			}
		})

		test('all categories have at least one element', () => {
			for (const [key, value] of Object.entries(CATEGORIES)) {
				expect(value.length).toBeGreaterThan(0)
			}
		})
	})

	describe('hierarchy consistency', () => {
		test('CORE starts with navigator', () => {
			expect(CATEGORIES.CORE[0]).toBe('navigator')
		})

		test('CONFIG is child of CORE', () => {
			expect(CATEGORIES.CONFIG[0]).toBe(CATEGORIES.CORE[0])
			expect(CATEGORIES.CONFIG[1]).toBe(CATEGORIES.CORE[1])
		})

		test('ACTIONS is child of SERVER', () => {
			expect(CATEGORIES.ACTIONS[0]).toBe(CATEGORIES.SERVER[0])
			expect(CATEGORIES.ACTIONS[1]).toBe(CATEGORIES.SERVER[1])
		})

		test('MCP_TOOLS is child of MCP', () => {
			expect(CATEGORIES.MCP_TOOLS[0]).toBe(CATEGORIES.MCP[0])
			expect(CATEGORIES.MCP_TOOLS[1]).toBe(CATEGORIES.MCP[1])
		})

		test('CLI_COMMANDS is child of CLI', () => {
			expect(CATEGORIES.CLI_COMMANDS[0]).toBe(CATEGORIES.CLI[0])
			expect(CATEGORIES.CLI_COMMANDS[1]).toBe(CATEGORIES.CLI[1])
		})
	})
})

describe('CategoryKey type', () => {
	test('key type includes ROOT', () => {
		const key: CategoryKey = 'ROOT'
		expect(key).toBe('ROOT')
	})

	test('key type includes ACTIONS', () => {
		const key: CategoryKey = 'ACTIONS'
		expect(key).toBe('ACTIONS')
	})

	test('key type includes all expected keys', () => {
		const keys: CategoryKey[] = [
			'ROOT',
			'CORE',
			'CONFIG',
			'SERVER',
			'ACTIONS',
			'BROWSER',
			'PAIRED',
			'SESSION',
			'MARKERS',
			'WATCH',
			'MCP',
			'MCP_TOOLS',
			'CLI',
			'CLI_COMMANDS',
			'HONO',
		]
		expect(keys).toHaveLength(15)
	})
})

describe('Category type', () => {
	test('accepts ROOT category value', () => {
		const category: Category = CATEGORIES.ROOT
		expect(category).toEqual(['navigator'])
	})

	test('accepts SERVER category value', () => {
		const category: Category = CATEGORIES.SERVER
		expect(category).toEqual(['navigator', 'server'])
	})

	test('accepts ACTIONS category value', () => {
		const category: Category = CATEGORIES.ACTIONS
		expect(category).toEqual(['navigator', 'server', 'actions'])
	})
})
