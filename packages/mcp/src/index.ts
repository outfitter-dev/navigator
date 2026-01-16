#!/usr/bin/env bun

/**
 * Navigator MCP Server
 *
 * Single-action MCP pattern for browser control.
 * Exposes one `navigator` tool with action routing instead of 26+ separate tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
	CATEGORIES,
	configureMcpLogging,
	getLogger,
} from '@outfitter/navigator-core/logging'
import { executeAction } from './client'
import { generateToolDescription } from './description'
import {
	ACTION_CATEGORIES,
	type ActionResult,
	type NavigatorAction,
	type PageSnap,
	type SnapNode,
	navigatorActionSchema,
} from './schema'

// ============================================================================
// Logger
// ============================================================================

const logger = getLogger(CATEGORIES.MCP)
const toolLogger = getLogger(CATEGORIES.MCP_TOOLS)

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
	{
		name: 'navigator',
		version: '0.1.0',
	},
	{
		capabilities: {
			tools: {},
		},
	},
)

// ============================================================================
// Tool Registration
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, () => {
	return {
		tools: [
			{
				name: 'navigator',
				description: generateToolDescription(),
				inputSchema: {
					type: 'object',
					properties: {
						action: {
							type: 'string',
							description: 'Action to perform',
							enum: Object.values(ACTION_CATEGORIES).flat(),
						},
						// Navigation params
						url: { type: 'string', description: 'URL for navigate/newTab' },
						waitUntil: {
							type: 'string',
							enum: ['load', 'domcontentloaded', 'networkidle'],
							description: 'Navigation wait condition',
						},
						hard: {
							type: 'boolean',
							description: 'Hard reload (bypass cache)',
						},
						// Element targeting
						ref: {
							type: 'string',
							description: 'Element reference from snap (e.g., "e42")',
						},
						selector: {
							type: 'string',
							description: 'CSS selector for element actions',
						},
						// Interaction params
						text: { type: 'string', description: 'Text for type action' },
						value: { type: 'string', description: 'Select option value' },
						button: {
							type: 'string',
							enum: ['left', 'right', 'middle'],
							description: 'Mouse button',
						},
						clickCount: {
							type: 'number',
							minimum: 1,
							maximum: 3,
							description: 'Click count (1-3)',
						},
						clear: {
							type: 'boolean',
							description: 'Clear field before typing',
						},
						delay: {
							type: 'number',
							description: 'Delay between keystrokes (ms)',
						},
						// Scroll params
						x: { type: 'number', description: 'Scroll X delta' },
						y: { type: 'number', description: 'Scroll Y delta' },
						// Tab params
						tab: {
							oneOf: [
								{ type: 'number', description: 'Live tab index (0, 1, 2...)' },
								{ type: 'string', description: 'Headless tab (b0, b1...)' },
							],
							description: 'Tab reference (default: active tab)',
						},
						// Wait params
						state: {
							type: 'string',
							enum: ['visible', 'hidden', 'attached', 'detached'],
							description: 'Element state to wait for',
						},
						timeout: { type: 'number', description: 'Timeout in milliseconds' },
						ms: { type: 'number', description: 'Milliseconds to wait' },
						// Snap params
						interactive: {
							type: 'boolean',
							description: 'Snap interactive elements only',
						},
						compact: {
							type: 'boolean',
							description: 'Compact snap output',
						},
						depth: {
							type: 'number',
							description: 'Max depth for snap',
						},
						// Screenshot params
						fullPage: { type: 'boolean', description: 'Full page screenshot' },
						quality: {
							type: 'number',
							description: 'Screenshot quality (1-100)',
						},
						// Display params
						preset: {
							type: 'string',
							enum: [
								'mobile',
								'tablet',
								'desktop',
								'desktop-xl',
								'desktop-2xl',
							],
							description: 'Viewport preset',
						},
						width: { type: 'number', description: 'Viewport width' },
						height: { type: 'number', description: 'Viewport height' },
						scheme: {
							type: 'string',
							enum: ['light', 'dark', 'no-preference'],
							description: 'Color scheme',
						},
						target: {
							type: 'string',
							enum: ['headless', 'windowed', 'guided'],
							description: 'Browser mode',
						},
						// Marker params
						id: { type: 'string', description: 'Marker id' },
						name: { type: 'string', description: 'Marker name' },
						tags: {
							type: 'array',
							items: { type: 'string' },
							description: 'Marker tags',
						},
						unreadOnly: {
							type: 'boolean',
							description: 'Filter unread markers only',
						},
						limit: { type: 'number', description: 'Limit results' },
						includeFiles: {
							type: 'boolean',
							description: 'Include marker files (html/css)',
						},
						includeScreenshot: {
							type: 'boolean',
							description: 'Include screenshot in response',
						},
					},
					required: ['action'],
				},
			},
		],
	}
})

// ============================================================================
// Response Types
// ============================================================================

type TextContent = { type: 'text'; text: string }
type ImageContent = { type: 'image'; data: string; mimeType: string }
type ResponseContent = TextContent | ImageContent

// ============================================================================
// Result Formatting
// ============================================================================

/**
 * Format action result into MCP response content
 */
function formatResult(result: ActionResult): ResponseContent[] {
	// Handle error case
	if (result.error) {
		return [{ type: 'text', text: `Error: ${result.error}` }]
	}

	// Handle snap response
	if (result.snap) {
		return [{ type: 'text', text: formatSnap(result.snap) }]
	}

	// Build content array for other responses
	const content: ResponseContent[] = []

	if (result.screenshot) {
		content.push({
			type: 'image',
			data: result.screenshot,
			mimeType: 'image/png',
		})
	}

	if (result.extractedContent) {
		content.push({ type: 'text', text: result.extractedContent })
	}

	if (result.data !== undefined) {
		content.push({ type: 'text', text: JSON.stringify(result.data, null, 2) })
	}

	// Default success message if no other content
	if (content.length === 0) {
		const message = result.domChanges
			? `Success. DOM changed: ${result.domChanges}`
			: 'Success'
		content.push({ type: 'text', text: message })
	}

	return content
}

// ============================================================================
// Tool Execution
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	if (request.params.name !== 'navigator') {
		toolLogger.warning`Unknown tool requested: ${request.params.name}`
		return {
			content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
			isError: true,
		}
	}

	const args = request.params.arguments as Record<string, unknown>
	const actionType = args?.action as string | undefined

	try {
		toolLogger.debug`Executing action: ${actionType}`
		const action = navigatorActionSchema.parse(args) as NavigatorAction
		const result = await executeAction(action)
		const content = formatResult(result)

		if (result.success) {
			toolLogger.debug`Action completed: ${actionType}`
		} else {
			toolLogger.warning`Action failed: ${actionType} - ${result.error}`
		}

		return { content, isError: !result.success }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		toolLogger.error`Action validation failed: ${actionType} - ${message}`
		return {
			content: [{ type: 'text', text: `Validation error: ${message}` }],
			isError: true,
		}
	}
})

// ============================================================================
// Snap Formatting (ARIA tree with symbol-prefixed refs)
// ============================================================================

function formatSnap(snap: PageSnap): string {
	const lines: string[] = [
		'# Page Snap',
		`Version: ${snap.version}`,
		'Ref format: e{index} (e.g., e42)',
		`URL: ${snap.url}`,
		`Title: ${snap.title}`,
		`Interactive elements: ${snap.interactiveCount}`,
		'',
		'## ARIA Tree',
		'',
	]

	if (typeof snap.tree === 'string') {
		lines.push(snap.tree)
		return lines.join('\n')
	}

	formatNode(snap.tree, lines, 0)

	return lines.join('\n')
}

function formatNode(node: SnapNode, lines: string[], depth: number): void {
	const indent = '  '.repeat(depth)
	let line = `${indent}- ${node.role}`

	if (node.name) {
		line += ` "${node.name}"`
	}

	if (node.ref && node.symbol !== undefined) {
		line += ` [${node.symbol}${node.ref}]`
	}

	lines.push(line)

	if (node.children) {
		for (const child of node.children) {
			formatNode(child, lines, depth + 1)
		}
	}
}

// ============================================================================
// Start Server
// ============================================================================

export async function startServer(): Promise<void> {
	// Configure logging to stderr only (stdout is for MCP protocol)
	await configureMcpLogging({
		level: process.env.NAV_LOG_LEVEL === 'debug' ? 'debug' : 'info',
	})

	const transport = new StdioServerTransport()
	await server.connect(transport)

	logger.info`MCP server started`
}

// Auto-start when run directly
if (import.meta.main) {
	startServer().catch((error) => {
		// Use console.error directly here since logging may not be configured
		console.error('Fatal error:', error)
		process.exit(1)
	})
}
