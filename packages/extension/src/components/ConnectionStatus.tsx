import type React from 'react'

interface ConnectionStatusProps {
	connected: boolean
	pairedMode?: boolean
	serverUrl?: string
}

/**
 * Connection status indicator component
 */
export function ConnectionStatus({
	connected,
	pairedMode,
	serverUrl,
}: ConnectionStatusProps): React.ReactElement {
	const statusColor = connected ? 'bg-green-500' : 'bg-red-500'
	const statusText = connected ? 'Connected' : 'Disconnected'
	const pulseClass = connected ? 'animate-pulse' : ''

	return (
		<div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
			<div className="flex items-center gap-3">
				<div className="relative">
					<div className={`h-3 w-3 rounded-full ${statusColor}`} />
					{connected && (
						<div
							className={`absolute inset-0 h-3 w-3 rounded-full ${statusColor} opacity-50 ${pulseClass}`}
						/>
					)}
				</div>
				<div>
					<div className="font-medium text-slate-900 text-sm">{statusText}</div>
					{serverUrl && (
						<div className="text-slate-500 text-xs">{serverUrl}</div>
					)}
				</div>
			</div>

			{pairedMode && (
				<div className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700 text-xs">
					Paired
				</div>
			)}
		</div>
	)
}

export default ConnectionStatus
