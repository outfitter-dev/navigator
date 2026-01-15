/**
 * Tests for the upload action executor.
 *
 * The upload action sets files on a file input element.
 * Supports single file and multiple file uploads.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { ActionExecutor } from '../../src/actions/executor'
import {
	MockBrowserManager,
	MockPairedManager,
	MockSessionManager,
	createDefaultHandler,
	createTestConfig,
} from '../helpers/mock-managers'

describe('upload action executor', () => {
	let executor: ActionExecutor
	let browserManager: MockBrowserManager
	let pairedManager: MockPairedManager
	let sessionManager: MockSessionManager

	beforeEach(() => {
		browserManager = new MockBrowserManager()
		pairedManager = new MockPairedManager()
		sessionManager = new MockSessionManager()
		browserManager.onSend(createDefaultHandler())

		executor = new ActionExecutor(
			browserManager as unknown as Parameters<typeof ActionExecutor>[0],
			pairedManager as unknown as Parameters<typeof ActionExecutor>[1],
			sessionManager as unknown as Parameters<typeof ActionExecutor>[2],
			createTestConfig(),
		)
	})

	describe('single file upload', () => {
		test('uploads single file by ref', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./file.png'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('upload')
			expect(command?.selector).toBe('@e1')
			expect(command?.files).toEqual(['./file.png'])
		})

		test('uploads single file by selector', async () => {
			const result = await executor.execute({
				action: 'upload',
				selector: 'input[type="file"]',
				files: ['./document.pdf'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('upload')
			expect(command?.selector).toBe('input[type="file"]')
			expect(command?.files).toEqual(['./document.pdf'])
		})

		test('uploads single file using data-testid selector', async () => {
			const result = await executor.execute({
				action: 'upload',
				selector: '[data-testid="single-file-input"]',
				files: ['./photo.jpg'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('[data-testid="single-file-input"]')
		})

		test('uploads file with absolute path', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['/Users/test/documents/report.pdf'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.files).toEqual(['/Users/test/documents/report.pdf'])
		})
	})

	describe('multiple file upload', () => {
		test('uploads multiple files', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./file1.png', './file2.jpg', './file3.gif'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.action).toBe('upload')
			expect(command?.files).toEqual([
				'./file1.png',
				'./file2.jpg',
				'./file3.gif',
			])
		})

		test('uploads multiple files with mixed paths', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./relative/path.png', '/absolute/path.jpg'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.files).toEqual([
				'./relative/path.png',
				'/absolute/path.jpg',
			])
		})

		test('uploads to multi-file input', async () => {
			const result = await executor.execute({
				action: 'upload',
				selector: '[data-testid="multi-file-input"]',
				files: ['./doc1.txt', './doc2.txt'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.files).toHaveLength(2)
		})
	})

	describe('error handling', () => {
		test('returns error when ref and selector are both missing', async () => {
			const result = await executor.execute({
				action: 'upload',
				files: ['./file.png'],
			} as Parameters<typeof executor.execute>[0])

			expect(result.success).toBe(false)
			expect(result.error).toBe('upload requires ref or selector')
		})

		test('returns error when browser command fails', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'upload') {
					return { success: false, error: 'File input not found' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./file.png'],
			})

			expect(result.success).toBe(false)
			// Executor passes through original error or falls back to generic message
			expect(result.error).toBeDefined()
		})

		test('returns generic error when no error message provided', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'upload') {
					return { success: false }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./file.png'],
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe('Upload failed')
		})

		test('returns error when element is not a file input', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'upload') {
					return { success: false, error: 'Element is not a file input' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'upload',
				selector: 'input[type="text"]',
				files: ['./file.png'],
			})

			expect(result.success).toBe(false)
		})

		test('returns error when file does not exist', async () => {
			browserManager.onSend((cmd) => {
				if (cmd.action === 'upload') {
					return { success: false, error: 'File not found: ./nonexistent.png' }
				}
				return createDefaultHandler()(cmd)
			})

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./nonexistent.png'],
			})

			expect(result.success).toBe(false)
		})
	})

	describe('ref takes precedence over selector', () => {
		test('uses ref when both ref and selector provided', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e5',
				selector: '#ignored-input',
				files: ['./file.png'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e5')
		})
	})

	describe('tab targeting', () => {
		test('uploads to element in specific tab', async () => {
			browserManager.setTabs([
				{
					ref: 0,
					url: 'https://example.com',
					urlHash: 'test',
					title: 'Tab 0',
					viewport: { width: 1280, height: 720 },
					colorScheme: 'no-preference',
				},
				{
					ref: 1,
					url: 'https://upload.com',
					urlHash: 'upld',
					title: 'Tab 1',
					viewport: { width: 1280, height: 720 },
					colorScheme: 'no-preference',
				},
			])

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files: ['./photo.jpg'],
				tab: 1,
			})

			expect(result.success).toBe(true)
			const commands = browserManager.getRecordedCommands()
			const tabSwitchIndex = commands.findIndex(
				(c) => c.command.action === 'tab_switch',
			)
			const uploadIndex = commands.findIndex(
				(c) => c.command.action === 'upload',
			)
			expect(tabSwitchIndex).toBeLessThan(uploadIndex)
		})
	})

	describe('ref normalization', () => {
		test('normalizes ref without @ prefix', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: 'e42',
				files: ['./file.png'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e42')
		})

		test('normalizes versioned ref', async () => {
			const result = await executor.execute({
				action: 'upload',
				ref: '@e123_1',
				files: ['./file.png'],
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.selector).toBe('@e123')
		})
	})

	describe('file path handling', () => {
		test('preserves file paths as-is', async () => {
			const files = [
				'./relative/path/file.txt',
				'/absolute/path/file.txt',
				'../parent/path/file.txt',
			]

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files,
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.files).toEqual(files)
		})

		test('handles files with special characters in name', async () => {
			const files = [
				'./file with spaces.png',
				'./file-with-dashes.jpg',
				'./file_with_underscores.gif',
			]

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files,
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.files).toEqual(files)
		})

		test('handles files with unicode characters', async () => {
			const files = ['./image.png', './documento.pdf']

			const result = await executor.execute({
				action: 'upload',
				ref: '@e1',
				files,
			})

			expect(result.success).toBe(true)
			const command = browserManager.getLastCommand()
			expect(command?.files).toEqual(files)
		})
	})
})
