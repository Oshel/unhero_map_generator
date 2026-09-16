import type { Size } from '../types/prefab';
import { BASE_TILE_PX } from './palette';

/** How far in the preview zooms. */
export const MAX_ZOOM = 4;

/**
 * How far out it zooms when the document is small. A 32 x 24 room at 25% is
 * already a postage stamp, so there is no reason to go past this for one room.
 */
export const COMFORTABLE_MIN_ZOOM = 0.25;

/** A tile below this is not a pixel any more, whatever the map size. */
export const ZOOM_FLOOR = 0.01;

/** Breathing room left around the document when fitting, in CSS pixels. */
const PADDING = 32;

/** The zoom at which the whole document fits the viewport. */
export function fitZoom(size: Size, viewport: { w: number; h: number }): number {
  const w = (viewport.w - PADDING) / Math.max(1, size.w * BASE_TILE_PX);
  const h = (viewport.h - PADDING) / Math.max(1, size.h * BASE_TILE_PX);
  return Math.max(ZOOM_FLOOR, Math.min(MAX_ZOOM, Math.min(w, h)));
}

/**
 * The floor for wheel and slider alike. A 512 tile map is 16384 pixels across,
 * so a fixed 25% floor leaves the player unable to zoom out far enough to see
 * what was generated - the floor has to follow the document.
 */
export function minZoom(size: Size, viewport: { w: number; h: number }): number {
  return Math.max(ZOOM_FLOOR, Math.min(COMFORTABLE_MIN_ZOOM, fitZoom(size, viewport)));
}
