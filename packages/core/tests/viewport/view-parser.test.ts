import { describe, expect, test } from 'bun:test'
import { parseViewFlag, resolveViewFlag } from '../../src/viewport/view-parser'

describe('parseViewFlag', () => {
	describe('single preset', () => {
		test('parses mobile preset', () => {
			expect(parseViewFlag('mobile')).toEqual([{ preset: 'mobile' }])
		})

		test('parses tablet preset', () => {
			expect(parseViewFlag('tablet')).toEqual([{ preset: 'tablet' }])
		})

		test('parses laptop preset', () => {
			expect(parseViewFlag('laptop')).toEqual([{ preset: 'laptop' }])
		})

		test('parses desktop preset', () => {
			expect(parseViewFlag('desktop')).toEqual([{ preset: 'desktop' }])
		})

		test('parses slate preset', () => {
			expect(parseViewFlag('slate')).toEqual([{ preset: 'slate' }])
		})

		test('parses mobile-xl preset', () => {
			expect(parseViewFlag('mobile-xl')).toEqual([{ preset: 'mobile-xl' }])
		})
	})

	describe('preset with orientation modifier', () => {
		test('parses mobile:landscape', () => {
			expect(parseViewFlag('mobile:landscape')).toEqual([
				{ preset: 'mobile', orientation: 'landscape' },
			])
		})

		test('parses tablet:portrait', () => {
			expect(parseViewFlag('tablet:portrait')).toEqual([
				{ preset: 'tablet', orientation: 'portrait' },
			])
		})

		test('parses tablet:both', () => {
			expect(parseViewFlag('tablet:both')).toEqual([
				{ preset: 'tablet', orientation: 'both' },
			])
		})

		test('parses laptop:portrait', () => {
			expect(parseViewFlag('laptop:portrait')).toEqual([
				{ preset: 'laptop', orientation: 'portrait' },
			])
		})

		test('parses desktop:landscape', () => {
			expect(parseViewFlag('desktop:landscape')).toEqual([
				{ preset: 'desktop', orientation: 'landscape' },
			])
		})
	})

	describe('multiple presets', () => {
		test('parses mobile,tablet', () => {
			expect(parseViewFlag('mobile,tablet')).toEqual([
				{ preset: 'mobile' },
				{ preset: 'tablet' },
			])
		})

		test('parses mobile,tablet,laptop with 3 entries', () => {
			expect(parseViewFlag('mobile,tablet,laptop')).toHaveLength(3)
		})

		test('parses mobile,tablet,laptop with correct values', () => {
			expect(parseViewFlag('mobile,tablet,laptop')).toEqual([
				{ preset: 'mobile' },
				{ preset: 'tablet' },
				{ preset: 'laptop' },
			])
		})

		test('parses presets with orientation modifiers', () => {
			expect(parseViewFlag('mobile:landscape,tablet:portrait')).toEqual([
				{ preset: 'mobile', orientation: 'landscape' },
				{ preset: 'tablet', orientation: 'portrait' },
			])
		})
	})

	describe('raw breakpoint', () => {
		test('parses lg breakpoint', () => {
			expect(parseViewFlag('lg')).toEqual([{ breakpoint: 'lg' }])
		})

		test('parses xs breakpoint', () => {
			expect(parseViewFlag('xs')).toEqual([{ breakpoint: 'xs' }])
		})

		test('parses md breakpoint', () => {
			expect(parseViewFlag('md')).toEqual([{ breakpoint: 'md' }])
		})

		test('parses xl breakpoint', () => {
			expect(parseViewFlag('xl')).toEqual([{ breakpoint: 'xl' }])
		})

		test('parses 2xl breakpoint', () => {
			expect(parseViewFlag('2xl')).toEqual([{ breakpoint: '2xl' }])
		})

		test('parses sm breakpoint', () => {
			expect(parseViewFlag('sm')).toEqual([{ breakpoint: 'sm' }])
		})
	})

	describe('raw width', () => {
		test('parses 500 as width-only', () => {
			expect(parseViewFlag('500')).toEqual([{ width: 500 }])
		})

		test('parses 1024 as width-only', () => {
			expect(parseViewFlag('1024')).toEqual([{ width: 1024 }])
		})

		test('parses 320 as width-only', () => {
			expect(parseViewFlag('320')).toEqual([{ width: 320 }])
		})
	})

	describe('explicit dimensions', () => {
		test('parses 500x800 as explicit dimensions', () => {
			expect(parseViewFlag('500x800')).toEqual([{ width: 500, height: 800 }])
		})

		test('parses 1920x1080 as explicit dimensions', () => {
			expect(parseViewFlag('1920x1080')).toEqual([
				{ width: 1920, height: 1080 },
			])
		})

		test('parses 375x812 as explicit dimensions', () => {
			expect(parseViewFlag('375x812')).toEqual([{ width: 375, height: 812 }])
		})

		test('parses 2560x1440 as explicit dimensions', () => {
			expect(parseViewFlag('2560x1440')).toEqual([
				{ width: 2560, height: 1440 },
			])
		})
	})

	describe('shorthands', () => {
		test('expands responsive to 5 presets', () => {
			expect(parseViewFlag('responsive')).toEqual([
				{ preset: 'mobile' },
				{ preset: 'tablet' },
				{ preset: 'slate' },
				{ preset: 'laptop' },
				{ preset: 'desktop' },
			])
		})

		test('expands all to 6 presets', () => {
			expect(parseViewFlag('all')).toHaveLength(6)
		})

		test('all includes mobile-xl', () => {
			const result = parseViewFlag('all')
			expect(result).toContainEqual({ preset: 'mobile-xl' })
		})
	})

	describe('shorthand with orientation', () => {
		test('expands all:portrait to 6 presets', () => {
			expect(parseViewFlag('all:portrait')).toHaveLength(6)
		})

		test('all:portrait sets portrait orientation on all', () => {
			const result = parseViewFlag('all:portrait')
			for (const spec of result) {
				expect(spec.orientation).toBe('portrait')
			}
		})

		test('expands all:both to 12 entries', () => {
			expect(parseViewFlag('all:both')).toHaveLength(12)
		})

		test('expands responsive:both to 10 entries', () => {
			expect(parseViewFlag('responsive:both')).toHaveLength(10)
		})

		test('expands responsive:landscape to 5 presets', () => {
			const result = parseViewFlag('responsive:landscape')
			expect(result).toHaveLength(5)
			for (const spec of result) {
				expect(spec.orientation).toBe('landscape')
			}
		})
	})
})

describe('resolveViewFlag', () => {
	describe('single preset resolution', () => {
		test('resolves mobile to full dimensions', () => {
			expect(resolveViewFlag('mobile')).toEqual([
				{ name: 'mobile', width: 375, height: 812, orientation: 'portrait' },
			])
		})

		test('resolves laptop to full dimensions', () => {
			expect(resolveViewFlag('laptop')).toEqual([
				{ name: 'laptop', width: 1280, height: 800, orientation: 'landscape' },
			])
		})

		test('resolves tablet to full dimensions', () => {
			expect(resolveViewFlag('tablet')).toEqual([
				{ name: 'tablet', width: 768, height: 1024, orientation: 'portrait' },
			])
		})
	})

	describe('preset with orientation override', () => {
		test('resolves mobile:landscape with swapped dimensions', () => {
			expect(resolveViewFlag('mobile:landscape')).toEqual([
				{ name: 'mobile', width: 812, height: 375, orientation: 'landscape' },
			])
		})

		test('resolves laptop:portrait with swapped dimensions', () => {
			expect(resolveViewFlag('laptop:portrait')).toEqual([
				{ name: 'laptop', width: 800, height: 1280, orientation: 'portrait' },
			])
		})

		test('resolves tablet:landscape with swapped dimensions', () => {
			expect(resolveViewFlag('tablet:landscape')).toEqual([
				{ name: 'tablet', width: 1024, height: 768, orientation: 'landscape' },
			])
		})
	})

	describe('explicit dimensions resolution', () => {
		test('resolves 500x800 to exact dimensions', () => {
			expect(resolveViewFlag('500x800')).toEqual([{ width: 500, height: 800 }])
		})

		test('resolves 1920x1080 to exact dimensions', () => {
			expect(resolveViewFlag('1920x1080')).toEqual([
				{ width: 1920, height: 1080 },
			])
		})
	})

	describe('shorthand resolution', () => {
		test('resolves responsive to 5 viewports', () => {
			expect(resolveViewFlag('responsive')).toHaveLength(5)
		})

		test('responsive includes correct preset names', () => {
			const result = resolveViewFlag('responsive')
			const names = result.map((v) => v.name)
			expect(names).toContain('mobile')
			expect(names).toContain('tablet')
			expect(names).toContain('slate')
			expect(names).toContain('laptop')
			expect(names).toContain('desktop')
		})

		test('resolves all:both to 12 viewports', () => {
			expect(resolveViewFlag('all:both')).toHaveLength(12)
		})
	})

	describe('breakpoint resolution', () => {
		test('resolves lg breakpoint to dimensions', () => {
			const result = resolveViewFlag('lg')
			expect(result[0].width).toBe(1024)
		})

		test('resolves xs breakpoint to dimensions', () => {
			const result = resolveViewFlag('xs')
			expect(result[0].width).toBe(375)
		})
	})

	describe('multiple presets resolution', () => {
		test('resolves mobile,tablet to 2 viewports', () => {
			const result = resolveViewFlag('mobile,tablet')
			expect(result).toHaveLength(2)
		})

		test('mobile,tablet has correct dimensions', () => {
			const result = resolveViewFlag('mobile,tablet')
			expect(result[0]).toEqual({
				name: 'mobile',
				width: 375,
				height: 812,
				orientation: 'portrait',
			})
			expect(result[1]).toEqual({
				name: 'tablet',
				width: 768,
				height: 1024,
				orientation: 'portrait',
			})
		})
	})

	describe('width-only resolution', () => {
		test('resolves raw width to default height', () => {
			const result = resolveViewFlag('500')
			expect(result[0].width).toBe(500)
			expect(result[0].height).toBeDefined()
		})
	})
})

describe('parseViewFlag validation', () => {
	describe('orientation validation', () => {
		test('throws for invalid orientation modifier', () => {
			expect(() => parseViewFlag('mobile:sideways')).toThrow(
				/Invalid orientation 'sideways'/,
			)
		})

		test('throws for invalid orientation on shorthand', () => {
			expect(() => parseViewFlag('all:invalid')).toThrow(
				/Invalid orientation 'invalid'/,
			)
		})

		test('throws for invalid orientation on responsive shorthand', () => {
			expect(() => parseViewFlag('responsive:diagonal')).toThrow(
				/Invalid orientation 'diagonal'/,
			)
		})

		test('accepts valid portrait orientation', () => {
			expect(() => parseViewFlag('mobile:portrait')).not.toThrow()
		})

		test('accepts valid landscape orientation', () => {
			expect(() => parseViewFlag('tablet:landscape')).not.toThrow()
		})

		test('accepts valid both orientation', () => {
			expect(() => parseViewFlag('desktop:both')).not.toThrow()
		})
	})

	describe('dimension validation', () => {
		test('throws for non-numeric width in WxH', () => {
			expect(() => parseViewFlag('foox800')).toThrow(
				/Invalid dimensions 'foox800'/,
			)
		})

		test('throws for non-numeric height in WxH', () => {
			expect(() => parseViewFlag('500xbar')).toThrow(
				/Invalid dimensions '500xbar'/,
			)
		})

		test('throws for partial WxH (missing height)', () => {
			expect(() => parseViewFlag('500x')).toThrow(/Invalid dimensions '500x'/)
		})

		test('throws for partial WxH (missing width)', () => {
			expect(() => parseViewFlag('x800')).toThrow(/Invalid dimensions 'x800'/)
		})

		test('accepts valid WxH dimensions', () => {
			expect(() => parseViewFlag('500x800')).not.toThrow()
		})

		test('accepts valid large dimensions', () => {
			expect(() => parseViewFlag('1920x1080')).not.toThrow()
		})
	})

	describe('empty value validation', () => {
		test('throws for empty string', () => {
			expect(() => parseViewFlag('')).toThrow(/cannot be empty/)
		})

		test('throws for whitespace-only string', () => {
			expect(() => parseViewFlag('   ')).toThrow(/cannot be empty/)
		})
	})
})
