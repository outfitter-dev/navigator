import { describe, expect, test } from 'bun:test'
import {
	getViewportDimensions,
	TAILWIND_BREAKPOINTS,
	VIEWPORT_PRESETS,
} from '../../src/viewport/presets'

describe('TAILWIND_BREAKPOINTS', () => {
	test('defines xs breakpoint at 375px', () => {
		expect(TAILWIND_BREAKPOINTS.xs).toBe(375)
	})

	test('defines sm breakpoint at 640px', () => {
		expect(TAILWIND_BREAKPOINTS.sm).toBe(640)
	})

	test('defines md breakpoint at 768px', () => {
		expect(TAILWIND_BREAKPOINTS.md).toBe(768)
	})

	test('defines lg breakpoint at 1024px', () => {
		expect(TAILWIND_BREAKPOINTS.lg).toBe(1024)
	})

	test('defines xl breakpoint at 1280px', () => {
		expect(TAILWIND_BREAKPOINTS.xl).toBe(1280)
	})

	test('defines 2xl breakpoint at 1536px', () => {
		expect(TAILWIND_BREAKPOINTS['2xl']).toBe(1536)
	})
})

describe('VIEWPORT_PRESETS', () => {
	describe('mobile preset', () => {
		test('has correct dimensions and properties', () => {
			expect(VIEWPORT_PRESETS.mobile).toEqual({
				name: 'mobile',
				width: 375,
				height: 812,
				orientation: 'portrait',
				tailwind: 'xs',
			})
		})
	})

	describe('mobile-xl preset', () => {
		test('has correct dimensions and properties', () => {
			expect(VIEWPORT_PRESETS['mobile-xl']).toEqual({
				name: 'mobile-xl',
				width: 430,
				height: 932,
				orientation: 'portrait',
			})
		})
	})

	describe('tablet preset', () => {
		test('has correct dimensions and properties', () => {
			expect(VIEWPORT_PRESETS.tablet).toEqual({
				name: 'tablet',
				width: 768,
				height: 1024,
				orientation: 'portrait',
				tailwind: 'md',
			})
		})
	})

	describe('slate preset', () => {
		test('has correct dimensions and properties', () => {
			expect(VIEWPORT_PRESETS.slate).toEqual({
				name: 'slate',
				width: 1024,
				height: 1366,
				orientation: 'portrait',
				tailwind: 'lg',
			})
		})
	})

	describe('laptop preset', () => {
		test('has correct dimensions and properties', () => {
			expect(VIEWPORT_PRESETS.laptop).toEqual({
				name: 'laptop',
				width: 1280,
				height: 800,
				orientation: 'landscape',
				tailwind: 'xl',
			})
		})
	})

	describe('desktop preset', () => {
		test('has correct dimensions and properties', () => {
			expect(VIEWPORT_PRESETS.desktop).toEqual({
				name: 'desktop',
				width: 1536,
				height: 864,
				orientation: 'landscape',
				tailwind: '2xl',
			})
		})
	})

	test('has exactly 6 presets defined', () => {
		expect(Object.keys(VIEWPORT_PRESETS)).toHaveLength(6)
	})
})

describe('getViewportDimensions', () => {
	describe('preset lookup', () => {
		test('returns dimensions for mobile preset', () => {
			expect(getViewportDimensions('mobile')).toEqual({
				width: 375,
				height: 812,
			})
		})

		test('returns dimensions for laptop preset', () => {
			expect(getViewportDimensions('laptop')).toEqual({
				width: 1280,
				height: 800,
			})
		})

		test('returns dimensions for tablet preset', () => {
			expect(getViewportDimensions('tablet')).toEqual({
				width: 768,
				height: 1024,
			})
		})

		test('returns dimensions for desktop preset', () => {
			expect(getViewportDimensions('desktop')).toEqual({
				width: 1536,
				height: 864,
			})
		})
	})

	describe('orientation override', () => {
		test('swaps mobile dimensions for landscape orientation', () => {
			expect(getViewportDimensions('mobile', 'landscape')).toEqual({
				width: 812,
				height: 375,
			})
		})

		test('swaps laptop dimensions for portrait orientation', () => {
			expect(getViewportDimensions('laptop', 'portrait')).toEqual({
				width: 800,
				height: 1280,
			})
		})

		test('swaps tablet dimensions for landscape orientation', () => {
			expect(getViewportDimensions('tablet', 'landscape')).toEqual({
				width: 1024,
				height: 768,
			})
		})

		test('keeps mobile dimensions when already portrait', () => {
			expect(getViewportDimensions('mobile', 'portrait')).toEqual({
				width: 375,
				height: 812,
			})
		})

		test('keeps laptop dimensions when already landscape', () => {
			expect(getViewportDimensions('laptop', 'landscape')).toEqual({
				width: 1280,
				height: 800,
			})
		})
	})

	describe('breakpoint lookup', () => {
		test('returns dimensions for lg breakpoint', () => {
			expect(getViewportDimensions('lg')).toEqual({
				width: 1024,
				height: 640,
			})
		})

		test('returns dimensions for xs breakpoint', () => {
			expect(getViewportDimensions('xs')).toEqual({
				width: 375,
				height: 812,
			})
		})

		test('returns dimensions for md breakpoint', () => {
			expect(getViewportDimensions('md')).toEqual({
				width: 768,
				height: 1024,
			})
		})

		test('returns dimensions for xl breakpoint', () => {
			expect(getViewportDimensions('xl')).toEqual({
				width: 1280,
				height: 800,
			})
		})

		test('returns dimensions for 2xl breakpoint', () => {
			expect(getViewportDimensions('2xl')).toEqual({
				width: 1536,
				height: 864,
			})
		})

		test('returns dimensions for sm breakpoint', () => {
			expect(getViewportDimensions('sm')).toEqual({
				width: 640,
				height: 480,
			})
		})
	})

	describe('error handling', () => {
		test('throws for invalid preset name', () => {
			expect(() => getViewportDimensions('invalid')).toThrow()
		})

		test('throws for empty string', () => {
			expect(() => getViewportDimensions('')).toThrow()
		})
	})
})
