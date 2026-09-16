import type { Constraints, Exit, Layers, Markers, RoomDoor, RoomRole, Size } from './prefab';

/** Prefab fields that are not tiles - edited in the left panel. */
export interface PrefabMeta {
  id: string;
  role: RoomRole;
  biome_tags: string[];
  subbiome_tags: string[];
  weight: number;
  constraints: Constraints;
}

/** Everything about the room that undo/redo has to restore. */
export interface RoomDoc {
  size: Size;
  /** Seed for decorative scatter; see RoomPrefab.decor_seed. */
  decorSeed: number;
  meta: PrefabMeta;
  exits: Exit[];
  doors: RoomDoor[];
  layers: Layers;
  markers: Markers;
}

export interface LayerVisibility {
  ground: boolean;
  blocking: boolean;
  deco: boolean;
  overlay: boolean;
  markers: boolean;
  exits: boolean;
  decals: boolean;
  fixtures: boolean;
  grid: boolean;
  chunkLines: boolean;
  validation: boolean;
}

export interface EditorView {
  zoom: number;
  panX: number;
  panY: number;
  visibility: LayerVisibility;
}

export function defaultMeta(): PrefabMeta {
  return {
    id: 'room_01',
    role: 'normal',
    biome_tags: [],
    subbiome_tags: [],
    weight: 10,
    constraints: { min_depth: 0, max_per_level: 2, min_players: 1 },
  };
}

export function emptyMarkers(): Markers {
  return { spawn: [], loot: [], prop: [], objective: [], light: [] };
}

export const DEFAULT_LIGHT_RADIUS = 6;
export const DEFAULT_PROP_KIND = 'barrel';
