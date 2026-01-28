/**
 * Sequence Command
 *
 * Execute multiple actions in sequence with variable interpolation.
 */

import { readFileSync } from 'node:fs'
import type { Command } from 'commander'
import type { NavigatorClient } from '../client.js'

interface SequenceStepResult {
	index: number
	action: string
	success: boolean
	duration: number
	error?: string
}

interface SequenceResult {
	success: boolean
	error?: string
	data?: {
		success: boolean
		completed: number
		total: number
		steps: SequenceStepResult[]
		stoppedAt?: number
		error?: string
	}
}

export function registerSequenceCommand(
	program: Command,
	getClient: () => NavigatorClient,
): void {
	program
		.command('sequence <file-or-json>')
		.description('Execute a sequence of actions from file or inline JSON')
		.option(
			'--params <json>',
			'Parameters for variable interpolation (JSON object)',
		)
		.option(
			'--stop-on-error',
			'Stop execution on first error (overrides JSON, default: true)',
		)
		.option('--no-stop-on-error', 'Continue execution on errors')
		.action(
			async (
				fileOrJson: string,
				options: { params?: string; stopOnError?: boolean },
			) => {
				const client = getClient()

				try {
					// Determine if input is a file path or inline JSON
					let sequenceData: {
						steps: unknown[]
						params?: Record<string, unknown>
						stopOnError?: boolean
					}

					if (fileOrJson.startsWith('{') || fileOrJson.startsWith('[')) {
						// Inline JSON
						const parsed = JSON.parse(fileOrJson)
						sequenceData = Array.isArray(parsed)
							? { steps: parsed }
							: {
									steps: parsed.steps ?? parsed,
									params: parsed.params,
									stopOnError: parsed.stopOnError,
								}
					} else {
						// File path
						const content = readFileSync(fileOrJson, 'utf8')
						const parsed = JSON.parse(content)
						sequenceData = Array.isArray(parsed)
							? { steps: parsed }
							: {
									steps: parsed.steps ?? parsed,
									params: parsed.params,
									stopOnError: parsed.stopOnError,
								}
					}

					// Merge CLI params with file params (CLI takes precedence)
					let params = sequenceData.params ?? {}
					if (options.params) {
						const cliParams = JSON.parse(options.params)
						params = { ...params, ...cliParams }
					}

					// CLI flag overrides JSON, JSON overrides default (true)
					const stopOnError =
						options.stopOnError ?? sequenceData.stopOnError ?? true

					const result = await client.execute<SequenceResult>({
						action: 'sequence',
						steps: sequenceData.steps,
						params: Object.keys(params).length > 0 ? params : undefined,
						stopOnError,
					})

					if (result.success && result.data) {
						const { data } = result

						console.log(
							`Sequence ${data.completed === data.total ? 'completed' : 'stopped'}: ${data.completed}/${data.total} steps`,
						)

						for (const step of data.steps) {
							const status = step.success ? '✓' : '✗'
							const duration = `${step.duration}ms`
							const error = step.error ? ` - ${step.error}` : ''
							console.log(
								`  ${status} [${step.index}] ${step.action} (${duration})${error}`,
							)
						}

						if (data.stoppedAt !== undefined) {
							console.log(`\nStopped at step ${data.stoppedAt}`)
						}
					} else {
						console.error('Sequence failed:', result.error)
						process.exitCode = 1
					}
				} catch (err) {
					if (err instanceof SyntaxError) {
						console.error('Invalid JSON:', err.message)
					} else if (
						err instanceof Error &&
						'code' in err &&
						err.code === 'ENOENT'
					) {
						console.error('File not found:', fileOrJson)
					} else {
						console.error(
							'Error:',
							err instanceof Error ? err.message : String(err),
						)
					}
					process.exitCode = 1
				}
			},
		)
}
