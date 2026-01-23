/**
 * Navigator-Agentation Integration
 *
 * Re-exports Agentation with Navigator-specific extensions.
 * Use this module instead of importing from 'agentation' directly
 * to ensure consistent behavior and type safety.
 */

// Re-export Agentation components and types
export {
	// Main component (aliased)
	PageFeedbackToolbarCSS as Agentation,
	PageFeedbackToolbarCSS,
	// Popup for custom UI (future customization)
	AnnotationPopupCSS,
	// Icons for consistent visuals
	IconCheck,
	IconCheckSmall,
	IconClose,
	IconListSparkle,
	IconPlus,
	// Types
	type AgentationProps,
	type Annotation,
	type AnnotationPopupCSSHandle,
	type AnnotationPopupCSSProps,
	type DemoAnnotation,
} from 'agentation'

// Re-export element identification utilities (what Agentation actually exports)
export {
	getElementClasses,
	getElementPath,
	getNearbyText,
	identifyAnimationElement,
	identifyElement,
} from 'agentation'

// Navigator bridge
export {
	AnnotationRefManager,
	annotationToMarker,
	formatAnnotationsMarkdown,
	indexToRef,
} from './bridge'

// Navigator types
export {
	type NavigatorAgentationProps,
	type NavigatorAnnotation,
	type NavigatorMarkerPayload,
	parseAccessibility,
	parseComputedStyles,
	toBoundingBox,
} from './types'
