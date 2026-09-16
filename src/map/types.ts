import type { ExitSide, Layers, Markers, RoomRole, Size } from '../types/prefab';
import type { RoomDoc } from '../types/editor';
import type { LayoutStyle } from '../gen/params';
import type { CheckResult } from '../validate/rules';

export interface PlacedRoom {
  /** Index in the map's room list. */
  index: number;
  /** Position in the room grid. */
  col: number;
  row: number;
  /** Subbiome profile this room was rolled under. */
  profile: string;
  /** Top-left corner of the room in map tiles. */
  x: number;
  y: number;
  doc: RoomDoc;
  role: RoomRole;
  style: LayoutStyle;
  claustrophobia: number;
}

/** A doorway shared by two neighbouring rooms. */
export interface MapLink {
  from: number;
  to: number;
  /** Side of the `from` room the door sits on. */
  side: ExitSide;
  /** The door tiles in map coordinates - one in each room, side by side. */
  tiles: Array<[number, number]>;
}

/** The way into the dungeon and the way out: one of each, both to the map edge. */
export interface MapPortal {
  kind: 'entrance' | 'exit';
  room: number;
  side: ExitSide;
  tiles: Array<[number, number]>;
}

export interface MapDoc {
  size: Size;
  decorSeed: number;
  /** Rooms fill the map as a grid of this many columns and rows. */
  cols: number;
  rows: number;
  cell: Size;
  /** Index of the room you arrive in, and of the arena you leave from. */
  entranceRoom: number;
  exitRoom: number;
  portals: MapPortal[];
  /** Composed grids, so the whole map draws and validates like one room. */
  layers: Layers;
  markers: Markers;
  rooms: PlacedRoom[];
  links: MapLink[];
}

export interface MapReport {
  ok: boolean;
  checks: CheckResult[];
}

export interface MapResult {
  doc: MapDoc;
  seed: number;
  attempts: number;
  report: MapReport;
}

/** Profile id meaning "roll a different one for every room". */
export const MIXED_PROFILE_ID = 'mixed';

/** Room sizes on a map: one box for the whole grid, picked by you or by the seed. */
export interface RoomSizing {
  mode: 'random' | 'fixed';
  /** Used when mode is 'fixed'. */
  w: number;
  h: number;
}

export interface MapParams {
  size: Size;
  /** The cell of the room grid. Every room on the map is this size. */
  roomSize: RoomSizing;
  /** A profile id, or MIXED_PROFILE_ID to roll one per room. */
  profile: string;
  /** 0..100 - how many doors go in beyond the spanning tree. */
  loopiness: number;
  markers: { spawn: number; loot: number; prop: number };
}

export const MAP_SIZE_PRESETS: ReadonlyArray<{ label: string; size: Size }> = [
  { label: '96 x 72', size: { w: 96, h: 72 } },
  { label: '160 x 120', size: { w: 160, h: 120 } },
  { label: '240 x 180', size: { w: 240, h: 180 } },
  { label: '320 x 240', size: { w: 320, h: 240 } },
];

export const MIN_CELL = 12;
export const MAX_CELL = 48;

export const MAX_MAP_ATTEMPTS = 30;
