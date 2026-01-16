/**
 * Step Logger
 *
 * Appends action steps to the session JSONL log.
 *
 * @module session/step-logger
 */

import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import {
	type Action,
	type LocatorStrategy,
	type Step,
	type StepResult,
	StepSchema,
	type StepSource,
	getStepsPath,
} from '@outfitter/navigator-core'

/**
 * Step Logger for JSONL session logs.
 */
export class StepLogger {
	constructor(
		private readonly projectRoot: string,
		private readonly sessionId: string,
	) {}

	/**
	 * Log a step to the session log.
	 *
	 * @param action - The action that was executed
	 * @param result - The result of the action
	 * @param duration - Execution time in ms
	 * @param source - Source of the action ('agent' or 'user')
	 * @param locator - Optional locator strategy for replay
	 * @returns The logged step
	 */
	async logStep(
		action: Action,
		result: StepResult,
		duration: number,
		source?: StepSource,
		locator?: LocatorStrategy,
	): Promise<Step> {
		const step: Step = {
			id: randomUUID(),
			timestamp: new Date().toISOString(),
			action,
			result,
			duration,
			source,
			locator,
		}

		// Validate before writing
		StepSchema.parse(step)

		// Append to steps file
		const stepsPath = getStepsPath(this.projectRoot, this.sessionId)
		await appendFile(stepsPath, `${JSON.stringify(step)}\n`, 'utf8')

		return step
	}

	/**
	 * Read all steps from the session log.
	 *
	 * @param limit - Maximum number of steps to return (most recent)
	 * @returns Array of steps
	 */
	async readSteps(limit?: number): Promise<Step[]> {
		const stepsPath = getStepsPath(this.projectRoot, this.sessionId)
		if (!existsSync(stepsPath)) return []

		const content = await readFile(stepsPath, 'utf8')
		const steps = content
			.split('\n')
			.filter((line) => line.trim())
			.map((line) => {
				try {
					return StepSchema.parse(JSON.parse(line))
				} catch {
					return null
				}
			})
			.filter((step): step is Step => step !== null)

		if (limit && limit > 0) {
			return steps.slice(-limit)
		}

		return steps
	}

	/**
	 * Get the count of steps in the session.
	 */
	async getStepCount(): Promise<number> {
		const stepsPath = getStepsPath(this.projectRoot, this.sessionId)
		if (!existsSync(stepsPath)) return 0

		const content = await readFile(stepsPath, 'utf8')
		return content.split('\n').filter((line) => line.trim()).length
	}

	/**
	 * Get the last step from the session.
	 */
	async getLastStep(): Promise<Step | null> {
		const steps = await this.readSteps(1)
		return steps[0] ?? null
	}
}
