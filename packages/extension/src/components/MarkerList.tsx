import type React from 'react'

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

interface MarkerListProps {
	markers: Marker[]
	onCopyToAgent?: () => void
	onClearMarkers?: () => void
}

/**
 * Format marker geometry for display
 */
function formatGeometry(geometry: MarkerGeometry): string {
	if (geometry.type === 'point') {
		return `Point (${Math.round(geometry.x)}, ${Math.round(geometry.y)})`
	}
	return `Region ${Math.round(geometry.width ?? 0)}x${Math.round(geometry.height ?? 0)}`
}

/**
 * Marker list display component
 */
export function MarkerList({
	markers,
	onCopyToAgent,
	onClearMarkers,
}: MarkerListProps): React.ReactElement {
	if (markers.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
				<div className="text-slate-400 text-sm">No markers created yet</div>
				<div className="mt-1 text-slate-400 text-xs">
					Enable marker mode and click or drag on the page
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="font-medium text-slate-700 text-sm">
					Markers ({markers.length})
				</div>
				<div className="flex gap-2">
					{onClearMarkers && (
						<button
							type="button"
							onClick={onClearMarkers}
							className="rounded px-2 py-1 text-slate-500 text-xs hover:bg-slate-100"
						>
							Clear
						</button>
					)}
				</div>
			</div>

			<div className="max-h-48 space-y-2 overflow-y-auto">
				{markers.map((marker) => (
					<div
						key={marker.id}
						className="rounded-lg border border-slate-200 bg-white p-3"
					>
						<div className="flex items-start justify-between">
							<div className="min-w-0 flex-1">
								<div className="font-medium text-slate-900 text-sm">
									{marker.note || formatGeometry(marker.geometry)}
								</div>
								<div className="mt-0.5 truncate text-slate-500 text-xs">
									{marker.title || marker.url}
								</div>
							</div>
							<div
								className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
									marker.geometry.type === 'point'
										? 'bg-blue-100 text-blue-700'
										: 'bg-purple-100 text-purple-700'
								}`}
							>
								{marker.geometry.type}
							</div>
						</div>
					</div>
				))}
			</div>

			{onCopyToAgent && markers.length > 0 && (
				<button
					type="button"
					onClick={onCopyToAgent}
					className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700"
				>
					Copy to Agent ({markers.length})
				</button>
			)}
		</div>
	)
}

export default MarkerList
