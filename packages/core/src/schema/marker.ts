/**
 * Marker Schema
 *
 * Defines markers with point and region geometry types.
 */

import { z } from 'zod'

// ============================================================================
// Geometry Types
// ============================================================================

export const PointGeometrySchema = z.object({
	type: z.literal('point'),
	x: z.number(),
	y: z.number(),
})

export type PointGeometry = z.infer<typeof PointGeometrySchema>

export const RegionGeometrySchema = z.object({
	type: z.literal('region'),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
})

export type RegionGeometry = z.infer<typeof RegionGeometrySchema>

export const GeometrySchema = z.discriminatedUnion('type', [
	PointGeometrySchema,
	RegionGeometrySchema,
])

export type Geometry = z.infer<typeof GeometrySchema>

// ============================================================================
// Marker Schema
// ============================================================================

export const MarkerSchema = z.object({
	id: z.string().uuid(),
	sessionId: z.string().uuid(),
	timestamp: z.string().datetime(),
	url: z.string(),
	title: z.string(),
	geometry: GeometrySchema,
	note: z.string().optional(),
	screenshot: z.string().optional(), // base64 or file path
})

export type Marker = z.infer<typeof MarkerSchema>

// ============================================================================
// Marker Creation Input
// ============================================================================

export interface MarkerCreateInput {
	url: string
	title: string
	geometry: Geometry
	note?: string | undefined
	screenshot?: string | undefined
}
