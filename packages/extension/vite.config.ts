import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/postcss'
import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import { defineConfig } from 'vite'
import manifest from './manifest.json'

export default defineConfig({
	base: './',
	plugins: [react(), crx({ manifest })],
	css: {
		postcss: {
			plugins: [
				tailwindcss({ config: path.resolve(__dirname, 'tailwind.config.cjs') }),
				autoprefixer(),
			],
		},
	},
	build: {
		outDir: path.resolve(__dirname, 'dist'),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				popup: path.resolve(__dirname, 'src/popup/index.html'),
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
})
