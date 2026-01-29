/**
 * Tool Description Generator
 *
 * Generates a concise description for the single `navigator` MCP tool.
 * Optimized for LLM comprehension within context budget (~500 tokens).
 */

import { getActionsForSurface } from '@outfitter/navigator-core'
import { ACTION_CATEGORIES } from './schema'

/**
 * Generate the tool description for the navigator MCP tool
 *
 * Design principles:
 * - Single tool reduces context overhead vs 26+ separate tools
 * - Snap → interact → snap workflow pattern
 */
export function generateToolDescription(): string {
	return `Browser automation for AI agents. Execute actions on web pages.

**Element References**: Use refs from \`snap\` output (e.g., "e42").

**Actions**:
${formatActionCategories()}

**Tab References**:
- 0, 1, 2: Live browser tabs (paired mode)
- b0, b1: Headless tabs (agent-controlled)

**Workflow**:
1. Use \`snap\` to get page structure with element refs
2. Perform actions using refs (click, type, etc.)
3. After page-changing actions (click, navigate), take a fresh snap - DOM changes may invalidate old refs

Selectors can be used instead of refs for most element actions: \`selector: ".btn"\`.

**Markers**:
- \`marker\`: capture element for visual regression
- \`markers\`: list captured markers
- \`markerGet\`, \`markerRead\`: retrieve marker details
- \`markerCompare\`: compare two markers
- \`markerDelete\`: delete a marker

**Sequences**:
Execute multiple actions in one call with \`{{var}}\` interpolation:
\`\`\`json
{"action":"sequence","steps":[{"action":"navigate","url":"{{url}}"},{"action":"snap"}],"params":{"url":"https://..."},"stopOnError":true}
\`\`\`
`
}

function formatActionCategories(): string {
	const actionDocs: Record<string, string> = {
		navigate: 'navigate(url)',
		back: 'back',
		forward: 'forward',
		reload: 'reload',
		tab: 'tab(ref)',
		tabs: 'tabs',
		newTab: 'newTab(url?)',
		closeTab: 'closeTab(ref)',
		click: 'click',
		type: 'type(text)',
		select: 'select(value)',
		hover: 'hover',
		scroll: 'scroll',
		find: 'find(text|role|label)',
		check: 'check',
		uncheck: 'uncheck',
		upload: 'upload(files)',
		dialog: 'dialog(handler)',
		press: 'press(key)',
		fill: 'fill(value)',
		focus: 'focus',
		waitFor: 'waitFor(ref, state?)',
		waitForNavigation: 'waitForNavigation',
		wait: 'wait(ms)',
		snap: 'snap(interactive?)',
		screenshot: 'screenshot(selector?, fullPage?)',
		html: 'html(selector?)',
		text: 'text(ref?)',
		marker: 'marker(selector|ref)',
		markers: 'markers',
		markerRead: 'markerRead(id)',
		markerGet: 'markerGet(id)',
		markerCompare: 'markerCompare(id1, id2)',
		markerDelete: 'markerDelete(id)',
		viewport: 'viewport(preset|width+height)',
		colorScheme: 'colorScheme(scheme)',
		mode: 'mode(target)',
		session: 'session',
		sessions: 'sessions(limit?)',
		steps: 'steps(sessionId?, limit?)',
		evaluate: 'evaluate(script, args?)',
		sequence: 'sequence(steps[], params?, stopOnError?)',
	}

	const mcpActions = new Set(getActionsForSurface('mcp'))

	return Object.entries(ACTION_CATEGORIES)
		.map(([category, actions]) => {
			const filtered = actions.filter((action) => mcpActions.has(action))
			if (filtered.length === 0) return null
			const desc = filtered
				.map((action) => actionDocs[action] ?? action)
				.join(', ')
			return `- **${category}**: ${desc}`
		})
		.filter(Boolean)
		.join('\n')
}
