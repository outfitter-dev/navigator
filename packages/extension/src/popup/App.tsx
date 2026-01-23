import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from 'react'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { MarkerList } from '../components/MarkerList'

const DEFAULT_SERVER_URL = 'http://localhost:9334'

interface MarkerGeometry {
	type: 'point' | 'region'
	x: number
	y: number
	width?: number
	height?: number
}

interface Marker {
	id: string
	geometry: MarkerGeometry
	note?: string
	url: string
	title: string
	createdAt?: number
}

interface StatusResponse {
	connected?: boolean
	pairedMode?: boolean
	agentationEnabled?: boolean
}

interface RuntimeMessage {
	type?: string
	payload?: Marker
	paired?: boolean
	enabled?: boolean
}

/**
 * Generate unique marker ID
 */
let markerIdCounter = 0
function generateMarkerId(): string {
	return `marker-${++markerIdCounter}-${Date.now()}`
}

function handleMarkerCreated(
	payload: Marker | undefined,
	setMarkers: Dispatch<SetStateAction<Marker[]>>,
): void {
	if (!payload) return
	setMarkers((prev) => [
		...prev,
		{
			...payload,
			id: payload.id || generateMarkerId(),
		} as Marker,
	])
}

function handleRuntimeMessage(
	message: RuntimeMessage,
	handlers: {
		setConnected: Dispatch<SetStateAction<boolean>>
		setPairedMode: Dispatch<SetStateAction<boolean>>
		setMarkerMode: Dispatch<SetStateAction<boolean>>
		setAgentationMode: Dispatch<SetStateAction<boolean>>
		setMarkers: Dispatch<SetStateAction<Marker[]>>
	},
): void {
	switch (message.type) {
		case 'connected':
			handlers.setConnected(true)
			return
		case 'disconnected':
			handlers.setConnected(false)
			handlers.setPairedMode(false)
			return
		case 'pairedModeChanged':
			handlers.setPairedMode(message.paired ?? false)
			return
		case 'markerCreated':
			handleMarkerCreated(message.payload, handlers.setMarkers)
			return
		case 'markerModeCancelled':
			handlers.setMarkerMode(false)
			return
		case 'agentationChanged':
			handlers.setAgentationMode(message.enabled ?? false)
			return
		default:
			return
	}
}

/**
 * Navigator extension popup UI
 */
export default function App() {
	const [connected, setConnected] = useState(false)
	const [pairedMode, setPairedMode] = useState(false)
	const [markerMode, setMarkerMode] = useState(false)
	const [agentationMode, setAgentationMode] = useState(false)
	const [markers, setMarkers] = useState<Marker[]>([])
	const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL)
	const [draftUrl, setDraftUrl] = useState(DEFAULT_SERVER_URL)
	const [showSettings, setShowSettings] = useState(false)

	/**
	 * Check connection status on mount
	 */
	useEffect(() => {
		// Get stored server URL
		chrome.storage.local.get(['serverUrl'], (result) => {
			const url = (result.serverUrl as string) || DEFAULT_SERVER_URL
			setServerUrl(url)
			setDraftUrl(url)
		})

		// Get connection status
		chrome.runtime.sendMessage(
			{ type: 'getStatus' },
			(response: StatusResponse) => {
				setConnected(response?.connected ?? false)
				setPairedMode(response?.pairedMode ?? false)
			},
		)

		// Get agentation status
		chrome.runtime.sendMessage(
			{ type: 'getAgentationStatus' },
			(response: { enabled?: boolean }) => {
				setAgentationMode(response?.enabled ?? false)
			},
		)

		// Listen for status updates
		const listener = (message: RuntimeMessage) =>
			handleRuntimeMessage(message, {
				setConnected,
				setPairedMode,
				setMarkerMode,
				setAgentationMode,
				setMarkers,
			})

		chrome.runtime.onMessage.addListener(listener)
		return () => chrome.runtime.onMessage.removeListener(listener)
	}, [])

	/**
	 * Toggle marker mode
	 */
	const handleMarkerModeToggle = useCallback(async () => {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
		if (!tab?.id) return

		const newMode = !markerMode
		chrome.tabs.sendMessage(tab.id, {
			type: newMode
				? 'navigator:enableMarkerMode'
				: 'navigator:disableMarkerMode',
		})
		setMarkerMode(newMode)
	}, [markerMode])

	/**
	 * Toggle paired mode
	 */
	const handlePairedModeToggle = useCallback(() => {
		if (pairedMode) {
			chrome.runtime.sendMessage({ type: 'disablePaired' })
		} else {
			chrome.runtime.sendMessage({ type: 'enablePaired' })
		}
	}, [pairedMode])

	/**
	 * Toggle Agentation mode (element-aware annotations)
	 */
	const handleAgentationModeToggle = useCallback(() => {
		const newMode = !agentationMode
		chrome.runtime.sendMessage({
			type: newMode ? 'enableAgentation' : 'disableAgentation',
		})
		setAgentationMode(newMode)

		// Disable classic marker mode when enabling Agentation
		if (newMode && markerMode) {
			chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
				if (tab?.id) {
					chrome.tabs.sendMessage(tab.id, {
						type: 'navigator:disableMarkerMode',
					})
				}
			})
			setMarkerMode(false)
		}
	}, [agentationMode, markerMode])

	/**
	 * Copy markers to clipboard as markdown
	 */
	const handleCopyToAgent = useCallback(async () => {
		if (markers.length === 0) return

		const markdown = markers
			.map((marker) => {
				const geo =
					marker.geometry.type === 'point'
						? `Point (${marker.geometry.x}, ${marker.geometry.y})`
						: `Region ${marker.geometry.width}x${marker.geometry.height}`

				let text = `- **${marker.note || geo}**`
				if (marker.note) {
					text += ` (${geo})`
				}
				text += `\n  - Page: ${marker.title}\n  - URL: ${marker.url}`
				return text
			})
			.join('\n\n')

		await navigator.clipboard.writeText(markdown)

		// Visual feedback could be added here
	}, [markers])

	/**
	 * Clear all markers
	 */
	const handleClearMarkers = useCallback(() => {
		setMarkers([])
	}, [])

	/**
	 * Save server URL
	 */
	const handleSaveServerUrl = useCallback(() => {
		chrome.storage.local.set({ serverUrl: draftUrl })
		setServerUrl(draftUrl)
		setShowSettings(false)

		// Trigger reconnect
		chrome.runtime.sendMessage({ type: 'connect' })
	}, [draftUrl])

	/**
	 * Reconnect to server
	 */
	const handleReconnect = useCallback(() => {
		chrome.runtime.sendMessage({ type: 'connect' })
	}, [])

	return (
		<div className="w-80 bg-white">
			{/* Header */}
			<div className="border-slate-200 border-b px-4 py-3">
				<div className="flex items-center justify-between">
					<h1 className="font-semibold text-lg text-slate-900">Navigator</h1>
					<button
						type="button"
						onClick={() => setShowSettings(!showSettings)}
						className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						title="Settings"
					>
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-labelledby="settings-icon-title"
						>
							<title id="settings-icon-title">Settings</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</button>
				</div>
				<p className="mt-0.5 text-slate-500 text-xs">
					Browser automation for AI agents
				</p>
			</div>

			{/* Settings panel */}
			{showSettings && (
				<div className="border-slate-200 border-b bg-slate-50 px-4 py-3">
					<label className="block">
						<span className="mb-1 block font-medium text-slate-700 text-xs">
							Server URL
						</span>
						<input
							type="text"
							value={draftUrl}
							onChange={(e) => setDraftUrl(e.target.value)}
							className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							placeholder={DEFAULT_SERVER_URL}
						/>
					</label>
					<div className="mt-2 flex gap-2">
						<button
							type="button"
							onClick={handleSaveServerUrl}
							className="flex-1 rounded bg-blue-600 px-3 py-1.5 font-medium text-sm text-white hover:bg-blue-700"
						>
							Save
						</button>
						<button
							type="button"
							onClick={() => setShowSettings(false)}
							className="flex-1 rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 text-sm hover:bg-slate-100"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Main content */}
			<div className="space-y-4 p-4">
				{/* Connection status */}
				<ConnectionStatus
					connected={connected}
					pairedMode={pairedMode}
					serverUrl={serverUrl}
				/>

				{/* Reconnect button if disconnected */}
				{!connected && (
					<button
						type="button"
						onClick={handleReconnect}
						className="w-full rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 text-sm hover:bg-slate-50"
					>
						Reconnect
					</button>
				)}

				{/* Mode toggles */}
				<div className="space-y-3">
					{/* Agentation Mode (element-aware) */}
					<div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
						<div>
							<div className="font-medium text-slate-900 text-sm">
								Agentation
							</div>
							<div className="text-slate-500 text-xs">
								Element-aware annotations with selectors
							</div>
						</div>
						<button
							type="button"
							onClick={handleAgentationModeToggle}
							className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
								agentationMode ? 'bg-purple-600' : 'bg-slate-200'
							}`}
							role="switch"
							aria-checked={agentationMode}
						>
							<span
								className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
									agentationMode ? 'translate-x-5' : 'translate-x-0'
								}`}
							/>
						</button>
					</div>

					{/* Classic Marker Mode (geometry-only) */}
					<div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
						<div>
							<div className="font-medium text-slate-900 text-sm">
								Classic Markers
							</div>
							<div className="text-slate-500 text-xs">
								Geometry-only point/region annotations
							</div>
						</div>
						<button
							type="button"
							onClick={handleMarkerModeToggle}
							disabled={agentationMode}
							className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
								markerMode ? 'bg-blue-600' : 'bg-slate-200'
							}`}
							role="switch"
							aria-checked={markerMode}
						>
							<span
								className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
									markerMode ? 'translate-x-5' : 'translate-x-0'
								}`}
							/>
						</button>
					</div>

					{/* Paired Mode */}
					<div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
						<div>
							<div className="font-medium text-slate-900 text-sm">
								Paired Mode
							</div>
							<div className="text-slate-500 text-xs">
								Allow agent to control this browser
							</div>
						</div>
						<button
							type="button"
							onClick={handlePairedModeToggle}
							disabled={!connected}
							className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
								pairedMode ? 'bg-green-600' : 'bg-slate-200'
							}`}
							role="switch"
							aria-checked={pairedMode}
						>
							<span
								className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
									pairedMode ? 'translate-x-5' : 'translate-x-0'
								}`}
							/>
						</button>
					</div>
				</div>

				{/* Marker list */}
				<MarkerList
					markers={markers}
					onCopyToAgent={handleCopyToAgent}
					onClearMarkers={handleClearMarkers}
				/>
			</div>

			{/* Footer */}
			<div className="border-slate-200 border-t px-4 py-2">
				<div className="text-center text-slate-400 text-xs">
					Navigator v0.1.0
				</div>
			</div>
		</div>
	)
}
