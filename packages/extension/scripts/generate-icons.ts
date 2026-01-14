/**
 * Generate placeholder PNG icons for the Navigator extension
 *
 * Run with: bun scripts/generate-icons.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Icon sizes needed for Chrome extension
const SIZES = [16, 48, 128]

// Navigator blue color
const PRIMARY_COLOR = '#3b82f6'
const BACKGROUND = '#ffffff'

/**
 * Generate a simple SVG icon
 */
function generateSvg(size: number): string {
	const padding = Math.round(size * 0.1)
	const innerSize = size - padding * 2

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}" rx="${Math.round(size * 0.15)}"/>
  <g transform="translate(${padding}, ${padding})">
    <path
      d="M${innerSize / 2} ${innerSize * 0.1}L${innerSize * 0.9} ${innerSize * 0.85}L${innerSize / 2} ${innerSize * 0.7}L${innerSize * 0.1} ${innerSize * 0.85}Z"
      fill="${PRIMARY_COLOR}"
    />
  </g>
</svg>`
}

/**
 * Convert SVG to PNG using canvas (requires runtime with canvas support)
 */
async function svgToPng(_svg: string, _size: number): Promise<Buffer> {
	// For now, we'll create a minimal 1x1 transparent PNG as placeholder
	// In production, you'd want to use a proper SVG->PNG conversion

	// Minimal valid PNG (1x1 transparent)
	// This is a base placeholder - replace with actual rendered icons
	const minimalPng = Buffer.from([
		0x89,
		0x50,
		0x4e,
		0x47,
		0x0d,
		0x0a,
		0x1a,
		0x0a, // PNG signature
		0x00,
		0x00,
		0x00,
		0x0d, // IHDR length
		0x49,
		0x48,
		0x44,
		0x52, // IHDR
		0x00,
		0x00,
		0x00,
		0x01, // width = 1
		0x00,
		0x00,
		0x00,
		0x01, // height = 1
		0x08,
		0x06, // bit depth 8, RGBA
		0x00,
		0x00,
		0x00, // compression, filter, interlace
		0x1f,
		0x15,
		0xc4,
		0x89, // CRC
		0x00,
		0x00,
		0x00,
		0x0a, // IDAT length
		0x49,
		0x44,
		0x41,
		0x54, // IDAT
		0x78,
		0x9c,
		0x63,
		0x00,
		0x01,
		0x00,
		0x00,
		0x05,
		0x00,
		0x01, // compressed data
		0x0d,
		0x0a,
		0x2d,
		0xb4, // CRC
		0x00,
		0x00,
		0x00,
		0x00, // IEND length
		0x49,
		0x45,
		0x4e,
		0x44, // IEND
		0xae,
		0x42,
		0x60,
		0x82, // CRC
	])

	return minimalPng
}

async function main() {
	const iconsDir = join(import.meta.dir, '..', 'public', 'icons')

	// Ensure icons directory exists
	mkdirSync(iconsDir, { recursive: true })

	console.log('Generating Navigator extension icons...')

	for (const size of SIZES) {
		const svg = generateSvg(size)
		const png = await svgToPng(svg, size)

		// Write SVG (for reference)
		writeFileSync(join(iconsDir, `icon-${size}.svg`), svg)
		console.log(`  Created icon-${size}.svg`)

		// Write placeholder PNG
		writeFileSync(join(iconsDir, `icon-${size}.png`), png)
		console.log(
			`  Created icon-${size}.png (placeholder - replace with rendered icon)`,
		)
	}

	console.log('')
	console.log('Note: PNG files are placeholders. To create proper icons:')
	console.log('1. Use the SVG files as source')
	console.log('2. Export to PNG at each size using Figma, Inkscape, or similar')
	console.log('3. Replace the placeholder PNGs')
}

main().catch(console.error)
