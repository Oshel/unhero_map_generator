/**
 * Room prefab schema shared with the game.
 *
 * This file is engine-agnostic on purpose: no Phaser, no DOM, no tool-only
 * types. It is meant to be copied verbatim into `packages/shared`.
 */

/** Tile roles. Never tileset indices - graphics are swapped per biome. */
export type TileRole =
  | 'floor'
  | 'wall'
  | 'obstacle_low'
  | 'obstacle_high'
  | 'pit'
  | 'water'
  | 'hazard'
  | 'void';

export const TILE_ROLES: readonly TileRole[] = [
  'floor',
  'wall',
  'obstacle_low',
  'obstacle_high',
  'pit',
  'water',
  'hazard',
  'void',
] as const;

/** Roles that may appear on the `ground` layer. */
export type GroundRole = Extract<TileRole, 'floor' | 'pit' | 'water' | 'hazard' | 'void'>;

/** Roles that may appear on the `blocking` layer. */
export type BlockingRole = Extract<TileRole, 'wall' | 'obstacle_low' | 'obstacle_high' | 'void'>;

export const GROUND_ROLES: readonly GroundRole[] = ['floor', 'pit', 'water', 'hazard', 'void'];
export const BLOCKING_ROLES: readonly BlockingRole[] = [
  'wall',
  'obstacle_low',
  'obstacle_high',
  'void',
];

export type RoomRole =
  | 'entrance'
  | 'normal'
  | 'arena'
  | 'treasure'
  | 'dead_end'
  | 'corridor'
  | 'boss'
  | 'exit';

export const ROOM_ROLES: readonly RoomRole[] = [
  'entrance',
  'normal',
  'arena',
  'treasure',
  'dead_end',
  'corridor',
  'boss',
  'exit',
] as const;

export type ExitSide = 'n' | 'e' | 's' | 'w';
export const EXIT_SIDES: readonly ExitSide[] = ['n', 'e', 's', 'w'] as const;

export type ExitType = 'door' | 'open' | 'locked' | 'secret';
export const EXIT_TYPES: readonly ExitType[] = ['door', 'open', 'locked', 'secret'] as const;

/** Exit width in tiles. Room openings and map gates are both 2 tiles. */
export type ExitWidth = 2;
export const EXIT_TILE_WIDTH: ExitWidth = 2;
export const GATE_TILE_WIDTH: ExitWidth = 2;

export interface Exit {
  side: ExitSide;
  /** Distance from the left edge (n/s) or the top edge (e/w), in tiles. */
  offset: number;
  width: ExitWidth;
  type: ExitType;
}

export interface Size {
  w: number;
  h: number;
}

export type LayerName = 'ground' | 'blocking' | 'deco' | 'overlay';
export const LAYER_NAMES: readonly LayerName[] = ['ground', 'blocking', 'deco', 'overlay'] as const;

/** Row-major grid indexed as `grid[y][x]`. */
export type TileGrid = TileRole[][];

export interface Layers {
  /** Walkable surface. Meaningful for gameplay. */
  ground: TileGrid;
  /** Movement / line-of-sight blockers. Meaningful for gameplay. */
  blocking: TileGrid;
  /** Purely visual, under the actors. */
  deco: TileGrid;
  /** Purely visual, above the actors. */
  overlay: TileGrid;
}

export type SpawnTier = 'trash' | 'normal' | 'elite' | 'boss';
export const SPAWN_TIERS: readonly SpawnTier[] = ['trash', 'normal', 'elite', 'boss'] as const;

export interface SpawnMarker {
  x: number;
  y: number;
  tier: SpawnTier;
}

export interface LootMarker {
  x: number;
  y: number;
}

export interface PropMarker {
  x: number;
  y: number;
  kind: string;
}

export interface ObjectiveMarker {
  x: number;
  y: number;
}

export interface LightMarker {
  x: number;
  y: number;
  radius: number;
}

export interface Markers {
  spawn: SpawnMarker[];
  loot: LootMarker[];
  prop: PropMarker[];
  objective: ObjectiveMarker[];
  light: LightMarker[];
}

export type MarkerKind = keyof Markers;
export const MARKER_KINDS: readonly MarkerKind[] = [
  'spawn',
  'loot',
  'prop',
  'objective',
  'light',
] as const;

/**
 * A door inside the room: the one-tile way into a sub-room. Rooms connect to
 * each other through plain two-tile openings; doors only ever stand between a
 * room and the chambers within it.
 */
export type DoorAxis = 'ns' | 'ew';

export interface RoomDoor {
  x: number;
  y: number;
  /** 'ns' means the wall runs east-west and you pass north-south. */
  axis: DoorAxis;
}

export interface Constraints {
  min_depth: number;
  max_per_level: number;
  min_players: number;
}

export interface RoomPrefab {
  id: string;
  size: Size;
  /**
   * Seed for cosmetic scatter only - decals and variant picks. Two rooms with
   * the same layout still decorate differently, and the same room decorates the
   * same way every time it is drawn. Nothing about gameplay depends on it.
   */
  decor_seed: number;
  role: RoomRole;
  biome_tags: string[];
  subbiome_tags: string[];
  weight: number;
  exits: Exit[];
  /** Doorways into the sub-rooms inside this room. */
  doors: RoomDoor[];
  layers: Layers;
  markers: Markers;
  constraints: Constraints;
}
