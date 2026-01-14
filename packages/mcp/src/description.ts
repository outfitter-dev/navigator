/**
 * Tool Description Generator
 *
 * Generates a concise description for the single `navigator` MCP tool.
 * Optimized for LLM comprehension within context budget (~500 tokens).
 */

import { ACTION_CATEGORIES } from './schema'

/**
 * Generate the tool description for the navigator MCP tool
 *
 * Design principles:
 * - Single tool reduces context overhead vs 26+ separate tools
 * - Symbol prefixes (#, @, $, %) communicate element types
 * - Snap → interact → snap workflow pattern
 */
export function generateToolDescription(): string {
	return `Browser automation for AI agents. Execute actions on web pages.

**Element References**: Use refs from \`snap\` output (e.g., "e42"). Symbols indicate type:
- #ref = text input (type action)
- @ref = link (click to navigate)
- $ref = button/interactive (click)
- %ref = image

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
`
}

function formatActionCategories(): string {
	const descriptions: Record<string, string> = {
		navigation: 'navigate(url), back, forward, reload',
		tabs: 'tab(ref), tabs, newTab(url?), closeTab(ref)',
		interaction:
			'click(ref|selector), type(ref|selector, text), select(ref|selector, value), hover, scroll',
		wait: 'waitFor(ref, state?), waitForNavigation, wait(ms)',
		capture:
			'snap(interactive?), screenshot(selector?, fullPage?), html(selector?), text(ref?)',
		markers: 'marker(selector), markers, markerRead(id), markerGet(id)',
		display: 'viewport(preset|width+height), colorScheme(scheme), mode(target)',
	}

	return Object.entries(ACTION_CATEGORIES)
		.map(([category]) => {
			const desc = descriptions[category]
			return desc ? `- **${category}**: ${desc}` : null
		})
		.filter(Boolean)
		.join('\n')
}
