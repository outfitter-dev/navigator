/**
 * Schema barrel export
 */

export {
	ActionSchema,
	type Action,
	type BrowserMode,
	type ClickAction,
	type MarkerAction,
	type ModeAction,
	type NavigateAction,
	type SnapAction,
	type TabRef,
	type TypeAction,
} from './action'

export {
	type Geometry,
	GeometrySchema,
	type Marker,
	type MarkerCreateInput,
	MarkerSchema,
	type PointGeometry,
	PointGeometrySchema,
	type RegionGeometry,
	RegionGeometrySchema,
} from './marker'

export {
	ActionResultSchema,
	type ActionResult,
	type ColorScheme,
	ColorSchemeSchema,
	type TabInfo,
	TabInfoSchema,
	type Viewport,
	ViewportSchema,
} from './result'

export {
	SESSION_CONTINUATION_TIMEOUT_MS,
	type SessionMeta,
	SessionMetaSchema,
	type SessionQuery,
	type SessionSummary,
	SessionSummarySchema,
	type Step,
	type StepResult,
	StepResultSchema,
	StepSchema,
	type StepSource,
	StepSourceSchema,
} from './session'
