/**
 * Tests for the --view flag in snap and screenshot action executors.
 *
 * The --view flag enables multi-viewport capture, cycling through specified
 * viewports while capturing snaps or screenshots at each size.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { ActionExecutor } from '../../src/actions/executor'
import {
	MockBrowserManager,
	MockPairedManager,
	MockSessionManager,
	createTestConfig,
} from '../helpers/mock-managers'

// ============================================================================
// Mock Response Helpers
// ============================================================================

type MockResponse = { success: boolean; data?: unknown; error?: string }
type ActionHandler = (command: Record<string, unknown>) => MockResponse

interface MockHandlerConfig {
	viewportCalls?: Array<{ width: number; height: number }>
	initialViewport?: { width: number; height: number }
	snapshotResponse?: MockResponse
	screenshotResponse?: MockResponse
}

/**
 * Creates a mock handler with configurable responses.
 * This reduces cognitive complexity by using object lookup instead of if/switch chains.
 */
function createMockHandler(config: MockHandlerConfig = {}): ActionHandler {
	const {
		viewportCalls,
		initialViewport = { width: 1280, height: 720 },
		snapshotResponse = {
			success: true,
			data: {
				snapshot: '<html>...</html>',
				refs: { e1: { selector: 'button' } },
			},
		},
		screenshotResponse = {
			success: true,
			data: { base64: 'base64-encoded-image-data' },
		},
	} = config

	const handlers: Record<string, ActionHandler> = {
		viewport: (cmd) => {
			viewportCalls?.push({
				width: cmd.width as number,
				height: cmd.height as number,
			})
			return { success: true }
		},
		evaluate: () => ({
			success: true,
			data: { result: initialViewport },
		}),
		snapshot: () => snapshotResponse,
		screenshot: () => screenshotResponse,
		url: () => ({ success: true, data: { url: 'https://example.com' } }),
		title: () => ({ success: true, data: { title: 'Test Page' } }),
	}

	return (command) => {
		const action = command.action as string
		const handler = handlers[action]
		return handler ? handler(command) : { success: true }
	}
}

// ============================================================================
// Snap Action Tests
// ============================================================================

describe('--view flag in snap action', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager
	let viewportCalls: Array<{ width: number; height: number }>

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()
		viewportCalls = []

		browserManager.onSend(createMockHandler({ viewportCalls }))

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	describe('single viewport', () => {
		test('captures at mobile preset', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'mobile',
			})

			expect(result.success).toBe(true)
			// Should have set viewport to mobile dimensions (375x812)
			expect(viewportCalls).toContainEqual({ width: 375, height: 812 })
			// Should have result with snaps array
			expect(result.data).toBeDefined()
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps).toHaveLength(1)
			expect(data.snaps[0].viewport).toBe('mobile')
		})

		test('captures at tablet preset', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'tablet',
			})

			expect(result.success).toBe(true)
			// Tablet is 768x1024
			expect(viewportCalls).toContainEqual({ width: 768, height: 1024 })
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps[0].viewport).toBe('tablet')
		})

		test('captures at laptop preset', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'laptop',
			})

			expect(result.success).toBe(true)
			// Laptop is 1280x800
			expect(viewportCalls).toContainEqual({ width: 1280, height: 800 })
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps[0].viewport).toBe('laptop')
		})

		test('captures at explicit dimensions', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: '500x800',
			})

			expect(result.success).toBe(true)
			expect(viewportCalls).toContainEqual({ width: 500, height: 800 })
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps[0].viewport).toBe('500x800')
		})

		test('captures with orientation modifier', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'mobile:landscape',
			})

			expect(result.success).toBe(true)
			// Mobile landscape swaps dimensions: 812x375
			expect(viewportCalls).toContainEqual({ width: 812, height: 375 })
		})
	})

	describe('multiple viewports', () => {
		test('captures at two presets', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'mobile,tablet',
			})

			expect(result.success).toBe(true)
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps).toHaveLength(2)
			expect(data.snaps[0].viewport).toBe('mobile')
			expect(data.snaps[1].viewport).toBe('tablet')
			// Verify both viewports were set
			expect(viewportCalls).toContainEqual({ width: 375, height: 812 })
			expect(viewportCalls).toContainEqual({ width: 768, height: 1024 })
		})

		test('captures responsive shorthand (5 viewports)', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'responsive',
			})

			expect(result.success).toBe(true)
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps).toHaveLength(5)
			// responsive = mobile, tablet, slate, laptop, desktop
			const viewportNames = data.snaps.map((s) => s.viewport)
			expect(viewportNames).toEqual([
				'mobile',
				'tablet',
				'slate',
				'laptop',
				'desktop',
			])
		})

		test('captures all shorthand (6 viewports)', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'all',
			})

			expect(result.success).toBe(true)
			const data = result.data as { snaps: Array<{ viewport: string }> }
			expect(data.snaps).toHaveLength(6)
			// all = mobile, mobile-xl, tablet, slate, laptop, desktop
			const viewportNames = data.snaps.map((s) => s.viewport)
			expect(viewportNames).toEqual([
				'mobile',
				'mobile-xl',
				'tablet',
				'slate',
				'laptop',
				'desktop',
			])
		})

		test('each snap entry contains viewport metadata', async () => {
			const result = await executor.execute({
				action: 'snap',
				view: 'mobile,laptop',
			})

			expect(result.success).toBe(true)
			const data = result.data as {
				snaps: Array<{
					viewport: string
					result: {
						tree?: string
						version?: number
						url?: string
						title?: string
					}
				}>
			}
			// Verify each snap has expected structure
			for (const snap of data.snaps) {
				expect(snap.viewport).toBeDefined()
				expect(snap.result).toBeDefined()
				expect(snap.result.url).toBe('https://example.com')
				expect(snap.result.title).toBe('Test Page')
			}
		})
	})

	describe('viewport restoration', () => {
		test('restores original viewport after capture', async () => {
			browserManager.onSend(
				createMockHandler({
					viewportCalls,
					initialViewport: { width: 1920, height: 1080 },
				}),
			)

			await executor.execute({
				action: 'snap',
				view: 'mobile',
			})

			// Should have called viewport twice: once for mobile, once to restore
			const mobileCall = viewportCalls.find(
				(v) => v.width === 375 && v.height === 812,
			)
			const restoreCall = viewportCalls.find(
				(v) => v.width === 1920 && v.height === 1080,
			)
			expect(mobileCall).toBeDefined()
			expect(restoreCall).toBeDefined()
		})

		test('restores viewport even on error', async () => {
			let snapshotCallCount = 0
			const baseHandler = createMockHandler({
				viewportCalls,
				initialViewport: { width: 1920, height: 1080 },
			})

			browserManager.onSend((command) => {
				const action = command.action as string
				if (action === 'snapshot') {
					snapshotCallCount++
					// Fail on the second snapshot (tablet)
					if (snapshotCallCount > 1) {
						return { success: false, error: 'Snapshot failed' }
					}
					return { success: true, data: { snapshot: '<html/>', refs: {} } }
				}
				return baseHandler(command)
			})

			const result = await executor.execute({
				action: 'snap',
				view: 'mobile,tablet',
			})

			// Should have failed
			expect(result.success).toBe(false)

			// But should still have restored viewport
			const restoreCall = viewportCalls.find(
				(v) => v.width === 1920 && v.height === 1080,
			)
			expect(restoreCall).toBeDefined()
		})
	})

	describe('paired mode', () => {
		test('returns error in paired mode', async () => {
			// isPairedActive() checks browserManager.getMode() === 'paired'
			await browserManager.setMode('paired')

			const result = await executor.execute({
				action: 'snap',
				view: 'mobile',
			})

			expect(result.success).toBe(false)
			expect(result.error).toContain('paired mode')
		})
	})
})

// ============================================================================
// Screenshot Action Tests
// ============================================================================

describe('--view flag in screenshot action', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager
	let viewportCalls: Array<{ width: number; height: number }>

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()
		viewportCalls = []

		browserManager.onSend(createMockHandler({ viewportCalls }))

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	describe('single viewport', () => {
		test('captures screenshot at mobile preset', async () => {
			const result = await executor.execute({
				action: 'screenshot',
				view: 'mobile',
			})

			expect(result.success).toBe(true)
			expect(viewportCalls).toContainEqual({ width: 375, height: 812 })
			const data = result.data as {
				screenshots: Array<{ viewport: string; data: string }>
			}
			expect(data.screenshots).toHaveLength(1)
			expect(data.screenshots[0].viewport).toBe('mobile')
			expect(data.screenshots[0].data).toBe('base64-encoded-image-data')
		})

		test('captures screenshot at desktop preset', async () => {
			const result = await executor.execute({
				action: 'screenshot',
				view: 'desktop',
			})

			expect(result.success).toBe(true)
			// Desktop is 1536x864
			expect(viewportCalls).toContainEqual({ width: 1536, height: 864 })
			const data = result.data as {
				screenshots: Array<{ viewport: string; data: string }>
			}
			expect(data.screenshots[0].viewport).toBe('desktop')
		})
	})

	describe('multiple viewports', () => {
		test('returns array of screenshots with viewport names', async () => {
			const result = await executor.execute({
				action: 'screenshot',
				view: 'mobile,tablet',
			})

			expect(result.success).toBe(true)
			const data = result.data as {
				screenshots: Array<{ viewport: string; data: string }>
			}
			expect(data.screenshots).toHaveLength(2)
			expect(data.screenshots[0].viewport).toBe('mobile')
			expect(data.screenshots[1].viewport).toBe('tablet')
			// Both should have screenshot data
			expect(data.screenshots[0].data).toBe('base64-encoded-image-data')
			expect(data.screenshots[1].data).toBe('base64-encoded-image-data')
		})

		test('captures responsive shorthand', async () => {
			const result = await executor.execute({
				action: 'screenshot',
				view: 'responsive',
			})

			expect(result.success).toBe(true)
			const data = result.data as {
				screenshots: Array<{ viewport: string; data: string }>
			}
			expect(data.screenshots).toHaveLength(5)
			const viewportNames = data.screenshots.map((s) => s.viewport)
			expect(viewportNames).toEqual([
				'mobile',
				'tablet',
				'slate',
				'laptop',
				'desktop',
			])
		})

		test('captures all shorthand', async () => {
			const result = await executor.execute({
				action: 'screenshot',
				view: 'all',
			})

			expect(result.success).toBe(true)
			const data = result.data as {
				screenshots: Array<{ viewport: string; data: string }>
			}
			expect(data.screenshots).toHaveLength(6)
		})
	})

	describe('viewport restoration', () => {
		test('restores original viewport after screenshots', async () => {
			browserManager.onSend(
				createMockHandler({
					viewportCalls,
					initialViewport: { width: 1920, height: 1080 },
				}),
			)

			await executor.execute({
				action: 'screenshot',
				view: 'mobile',
			})

			// Should restore to original 1920x1080
			const restoreCall = viewportCalls.find(
				(v) => v.width === 1920 && v.height === 1080,
			)
			expect(restoreCall).toBeDefined()
		})
	})

	describe('screenshot options', () => {
		test('respects fullPage option', async () => {
			let screenshotCommand: Record<string, unknown> | undefined

			const baseHandler = createMockHandler({ viewportCalls })
			browserManager.onSend((command) => {
				if (command.action === 'screenshot') {
					screenshotCommand = command
				}
				return baseHandler(command)
			})

			await executor.execute({
				action: 'screenshot',
				view: 'mobile',
				fullPage: true,
			})

			expect(screenshotCommand?.fullPage).toBe(true)
		})

		test('respects quality option', async () => {
			let screenshotCommand: Record<string, unknown> | undefined

			const baseHandler = createMockHandler({ viewportCalls })
			browserManager.onSend((command) => {
				if (command.action === 'screenshot') {
					screenshotCommand = command
				}
				return baseHandler(command)
			})

			await executor.execute({
				action: 'screenshot',
				view: 'mobile',
				quality: 80,
			})

			expect(screenshotCommand?.quality).toBe(80)
		})
	})
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('--view flag error handling', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()

		browserManager.onSend(createMockHandler({}))

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	test('returns error for invalid view spec', async () => {
		// The resolveViewFlag function throws for invalid specs
		// But the executor catches this and returns an error result
		const result = await executor.execute({
			action: 'snap',
			view: 'invalid-preset-name',
		})

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
	})

	test('returns error when viewport set fails', async () => {
		const baseHandler = createMockHandler({})
		browserManager.onSend((command) => {
			if (command.action === 'viewport') {
				return { success: false, error: 'Viewport failed' }
			}
			return baseHandler(command)
		})

		const result = await executor.execute({
			action: 'snap',
			view: 'mobile',
		})

		expect(result.success).toBe(false)
		expect(result.error).toContain('Failed to set viewport')
	})

	test('returns error when snapshot fails at specific viewport', async () => {
		browserManager.onSend(
			createMockHandler({
				snapshotResponse: { success: false, error: 'Snapshot failed' },
			}),
		)

		const result = await executor.execute({
			action: 'snap',
			view: 'mobile',
		})

		expect(result.success).toBe(false)
		// The error comes from the underlying snap method which returns "Snapshot failed"
		expect(result.error).toContain('Snapshot failed')
	})

	test('returns error when screenshot fails at specific viewport', async () => {
		browserManager.onSend(
			createMockHandler({
				screenshotResponse: { success: false, error: 'Screenshot failed' },
			}),
		)

		const result = await executor.execute({
			action: 'screenshot',
			view: 'mobile',
		})

		expect(result.success).toBe(false)
		expect(result.error).toContain('Screenshot failed')
	})
})

// ============================================================================
// Tailwind Breakpoint Tests
// ============================================================================

describe('--view flag with Tailwind breakpoints', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager
	let viewportCalls: Array<{ width: number; height: number }>

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()
		viewportCalls = []

		browserManager.onSend(createMockHandler({ viewportCalls }))

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	test('captures at xs breakpoint', async () => {
		const result = await executor.execute({
			action: 'snap',
			view: 'xs',
		})

		expect(result.success).toBe(true)
		// xs = 375x812
		expect(viewportCalls).toContainEqual({ width: 375, height: 812 })
	})

	test('captures at lg breakpoint', async () => {
		const result = await executor.execute({
			action: 'snap',
			view: 'lg',
		})

		expect(result.success).toBe(true)
		// lg = 1024x640
		expect(viewportCalls).toContainEqual({ width: 1024, height: 640 })
	})

	test('captures at 2xl breakpoint', async () => {
		const result = await executor.execute({
			action: 'snap',
			view: '2xl',
		})

		expect(result.success).toBe(true)
		// 2xl = 1536x864
		expect(viewportCalls).toContainEqual({ width: 1536, height: 864 })
	})

	test('captures multiple breakpoints', async () => {
		const result = await executor.execute({
			action: 'snap',
			view: 'xs,md,xl',
		})

		expect(result.success).toBe(true)
		const data = result.data as { snaps: Array<{ viewport: string }> }
		expect(data.snaps).toHaveLength(3)
		// xs = 375x812, md = 768x1024, xl = 1280x800
		expect(viewportCalls).toContainEqual({ width: 375, height: 812 })
		expect(viewportCalls).toContainEqual({ width: 768, height: 1024 })
		expect(viewportCalls).toContainEqual({ width: 1280, height: 800 })
	})
})
