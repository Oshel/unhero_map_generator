import type { MarkerKind, TileRole } from '../types/prefab';

/** Fallback colours - the tool has to be usable with no art at all. */
export const ROLE_COLORS: Record<TileRole, string> = {
  floor: '#3a3f47',
  wall: '#20252d',
  obstacle_low: '#6b5738',
  obstacle_high: '#8a6a3a',
  pit: '#0b0d10',
  water: '#1f4f70',
  hazard: '#7a2733',
  void: '#00000000',
};

export const ROLE_LABELS: Record<TileRole, string> = {
  floor: 'Floor',
  wall: 'Wall',
  obstacle_low: 'Obstacle (low)',
  obstacle_high: 'Obstacle (high)',
  pit: 'Pit',
  water: 'Water',
  hazard: 'Hazard',
  void: 'Void / erase',
};

export const MARKER_COLORS: Record<MarkerKind, string> = {
  spawn: '#e0574d',
  loot: '#e8c04a',
  prop: '#9a7be0',
  objective: '#4ad0c0',
  light: '#f2f0d5',
};

export const MARKER_LABELS: Record<MarkerKind, string> = {
  spawn: 'Spawn',
  loot: 'Loot',
  prop: 'Prop',
  objective: 'Objective',
  light: 'Light',
};

export const CANVAS_BG = '#0d0f12';
/** Wall with wall on all eight sides - drawn as plain dark, never textured. */
export const ROCK_COLOR = '#000000';
export const GRID_COLOR = 'rgba(255,255,255,0.06)';
export const CHUNK_COLOR = 'rgba(255,255,255,0.18)';
export const EXIT_COLOR = '#49c16a';
export const DOOR_COLOR = '#c08a3e';
export const GATE_COLOR = '#d9b25a';
export const PROBLEM_COLOR = 'rgba(224,68,68,0.45)';
/** The straight run from the entrance gate to the exit. */
export const ROUTE_COLOR = '#63d0ff';
export const BASE_TILE_PX = 32;
