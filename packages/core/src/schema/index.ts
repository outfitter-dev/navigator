/**
 * Schema barrel export
 */

export {
	ActionSchema,
	type Action,
	type BrowserMode,
	type CheckAction,
	type ClickAction,
	type DialogAction,
	type FillAction,
	type FindAction,
	type MarkerAction,
	type ModeAction,
	type NavigateAction,
	type PressAction,
	type ScreenshotAction,
	type SnapAction,
	type TabRef,
	type TypeAction,
	type UncheckAction,
	type UploadAction,
} from './action'

export {
	type AccessibilityInfo,
	AccessibilityInfoSchema,
	type BoundingBox,
	BoundingBoxSchema,
	type ElementMetadata,
	ElementMetadataSchema,
	type Geometry,
	GeometrySchema,
	type Marker,
	type MarkerCreateInput,
	MarkerSchema,
	type MarkerViewport,
	MarkerViewportSchema,
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
	ErrorCode,
	type ErrorCode as ErrorCodeType,
	ErrorCodeSchema,
	type TabInfo,
	TabInfoSchema,
	type Viewport,
	ViewportSchema,
} from './result'

export {
	type LocatorStrategy,
	LocatorStrategySchema,
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
