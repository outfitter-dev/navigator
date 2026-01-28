export const CAPABILITY_SURFACES = ['cli', 'mcp', 'server'] as const

export type CapabilitySurface = (typeof CAPABILITY_SURFACES)[number]

export type ActionCapability = {
	surfaces: readonly CapabilitySurface[]
	notes?: string
}

export const ACTION_CAPABILITIES = {
	// Navigation
	navigate: { surfaces: ['cli', 'mcp'] },
	back: { surfaces: ['cli', 'mcp'] },
	forward: { surfaces: ['cli', 'mcp'] },
	reload: { surfaces: ['cli', 'mcp'] },
	// Tabs
	tab: { surfaces: ['cli', 'mcp'] },
	tabs: { surfaces: ['cli', 'mcp'] },
	newTab: { surfaces: ['cli', 'mcp'] },
	closeTab: { surfaces: ['cli', 'mcp'] },
	// Interaction
	click: { surfaces: ['cli', 'mcp'] },
	type: { surfaces: ['cli', 'mcp'] },
	select: { surfaces: ['cli', 'mcp'] },
	hover: { surfaces: ['cli', 'mcp'] },
	focus: { surfaces: ['mcp'] },
	scroll: { surfaces: ['cli', 'mcp'] },
	press: { surfaces: ['cli', 'mcp'] },
	fill: { surfaces: ['cli', 'mcp'] },
	find: { surfaces: ['cli', 'mcp'] },
	check: { surfaces: ['cli', 'mcp'] },
	uncheck: { surfaces: ['cli', 'mcp'] },
	upload: { surfaces: ['cli', 'mcp'] },
	download: { surfaces: ['server'], notes: 'Server-only for now' },
	dialog: { surfaces: ['cli', 'mcp'] },
	// Wait
	waitFor: { surfaces: ['mcp'] },
	waitForNavigation: { surfaces: ['mcp'] },
	wait: { surfaces: ['mcp'] },
	// Capture
	snap: { surfaces: ['cli', 'mcp'] },
	screenshot: { surfaces: ['cli', 'mcp'] },
	html: { surfaces: ['mcp'] },
	text: { surfaces: ['mcp'] },
	// Markers
	marker: { surfaces: ['cli', 'mcp'] },
	markers: { surfaces: ['cli', 'mcp'] },
	markerGet: { surfaces: ['cli', 'mcp'] },
	markerRead: { surfaces: ['mcp'] },
	markerCompare: { surfaces: ['cli', 'mcp'] },
	markerDelete: { surfaces: ['cli', 'mcp'] },
	markerResolve: { surfaces: ['cli'], notes: 'CLI-only for now' },
	// Display
	viewport: { surfaces: ['cli', 'mcp'] },
	colorScheme: { surfaces: ['cli', 'mcp'] },
	mode: { surfaces: ['mcp'] },
	// Evaluate
	evaluate: { surfaces: ['mcp'] },
	// Session
	session: { surfaces: ['cli', 'mcp'] },
	sessions: { surfaces: ['mcp'] },
	steps: { surfaces: ['cli', 'mcp'] },
	// Sequence
	sequence: { surfaces: ['cli', 'mcp'] },
} as const satisfies Record<string, ActionCapability>

export function getActionsForSurface(surface: CapabilitySurface): string[] {
	return Object.entries(ACTION_CAPABILITIES)
		.filter(([, capability]) =>
			(capability.surfaces as readonly CapabilitySurface[]).includes(surface),
		)
		.map(([action]) => action)
}
