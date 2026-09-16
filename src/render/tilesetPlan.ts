import type { TileRole } from '../types/prefab';
import { TILE_ROLES } from '../types/prefab';

/**
 * Two manifest shapes are accepted.
 *
 * 1. The tool's own shape - one square PNG per variant, role to files:
 *
 *    { "tileSize": 32, "roles": { "floor": ["floor_a.png", "floor_b.png"] } }
 *
 * 2. The "sheet" shape produced by asset packs built for the game renderer -
 *    files to role, with weights, plus optional blob47 autotiling sheets:
 *
 *    {
 *      "tile_size": 32,
 *      "blob": { "columns": 8, "wall": "wall_blob47.png", "masks": [0, 1, ...] },
 *      "textures": [{ "file": "floor.png", "role": "floor", "weight": 8 }],
 *      "objects":  [{ "file": "objects/urn.png", "role": "obstacle_low" }]
 *    }
 *
 * Everything is resolved into a TilesetPlan before a single byte is decoded, so
 * the mapping is testable without a DOM.
 */

export interface BlobPlan {
  file: string;
  /** null means "work it out from the sheet width and tileSize". */
  columns: number | null;
  /** Neighbour masks in sheet order; the array position is the tile index. */
  masks: number[];
}

export interface DecalPlan {
  file: string;
  /** Tile role the decal is scattered on. */
  on: TileRole;
  /** 0..1 chance per tile. */
  density: number;
  /**
   * How far off the tile centre a decal may sit, as a fraction of the tile.
   * 0 pins everything to the grid, which is exactly what betrays it as a grid.
   */
  jitter: number;
}

/**
 * Fixtures are not tiles: they are the thing you walk through. A door fills one
 * tile of a room wall, a gate spans the two tiles of a map entrance.
 */
export type FixtureKey = 'door_ns' | 'door_ew' | 'gate_ns' | 'gate_ew';

export const FIXTURE_KEYS: readonly FixtureKey[] = [
  'door_ns',
  'door_ew',
  'gate_ns',
  'gate_ew',
] as const;

export interface TilesetPlan {
  tileSize: number;
  /** Role to file list. A file repeated N times is N times more likely. */
  files: Partial<Record<TileRole, string[]>>;
  blobs: Partial<Record<TileRole, BlobPlan>>;
  decals: DecalPlan[];
  fixtures: Partial<Record<FixtureKey, string[]>>;
  /** Human readable notes about entries that were dropped and why. */
  notes: string[];
}

/** Layer names that asset packs sometimes put in a "role" field. */
const LAYER_WORDS = new Set(['deco', 'overlay', 'ground', 'blocking']);

const MAX_WEIGHT = 8;

/** Enough to break the lattice, not enough to push a decal onto its neighbour. */
export const DEFAULT_DECAL_JITTER = 0.22;

function isTileRole(value: unknown): value is TileRole {
  return typeof value === 'string' && (TILE_ROLES as readonly string[]).includes(value);
}

function addFiles(plan: TilesetPlan, role: TileRole, file: string, weight: number): void {
  const list = plan.files[role] ?? [];
  const times = Math.max(1, Math.min(MAX_WEIGHT, Math.round(weight)));
  for (let i = 0; i < times; i++) list.push(file);
  plan.files[role] = list;
}

function planFromRolesMap(raw: Record<string, unknown>, plan: TilesetPlan): void {
  const roles = raw.roles as Record<string, unknown>;
  for (const [role, paths] of Object.entries(roles)) {
    if (!isTileRole(role)) {
      plan.notes.push(
        LAYER_WORDS.has(role)
          ? `"${role}" is a layer, not a tile role - skipped`
          : `unknown role "${role}" - skipped`,
      );
      continue;
    }
    if (!Array.isArray(paths)) {
      plan.notes.push(`roles.${role} is not an array - skipped`);
      continue;
    }
    for (const entry of paths) {
      // A variant is either "file.png" or { "file": "file.png", "weight": 8 }.
      if (typeof entry === 'string') {
        addFiles(plan, role, entry, 1);
        continue;
      }
      if (typeof entry === 'object' && entry !== null) {
        const e = entry as Record<string, unknown>;
        if (typeof e.file === 'string') {
          addFiles(plan, role, e.file, typeof e.weight === 'number' ? e.weight : 1);
          continue;
        }
      }
      plan.notes.push(`roles.${role}: variant entry is neither a filename nor { file, weight }`);
    }
  }
}

function planFromSheetManifest(raw: Record<string, unknown>, plan: TilesetPlan): void {
  const entries = [
    ...((raw.textures as unknown[]) ?? []),
    ...((raw.objects as unknown[]) ?? []),
  ];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const file = typeof e.file === 'string' ? e.file : null;
    if (!file) continue;
    if (!isTileRole(e.role)) {
      plan.notes.push(
        LAYER_WORDS.has(String(e.role))
          ? `${file}: "${String(e.role)}" is a layer, not a tile role - skipped`
          : `${file}: unknown role "${String(e.role)}" - skipped`,
      );
      continue;
    }
    addFiles(plan, e.role, file, typeof e.weight === 'number' ? e.weight : 1);
  }
}

/**
 * Autotiling sheets, in either spelling:
 *
 *   "blob":   { "columns": 8, "masks": [...], "wall": "wall_blob47.png" }
 *   "blob47": { "wall": { "sheet": "wall_blob47.png", "masks": [...] } }
 *
 * Both are read whatever shape the rest of the manifest uses.
 */
function planBlobSheets(raw: Record<string, unknown>, plan: TilesetPlan): void {
  const flat = raw.blob as Record<string, unknown> | undefined;
  if (flat && typeof flat === 'object') {
    const columns = typeof flat.columns === 'number' ? flat.columns : null;
    const masks = Array.isArray(flat.masks) ? (flat.masks as unknown[]).map(Number) : [];
    if (masks.length === 0) {
      plan.notes.push('blob: no mask table - autotiling disabled');
    } else {
      for (const [key, value] of Object.entries(flat)) {
        if (!isTileRole(key)) continue;
        if (typeof value !== 'string') {
          plan.notes.push(`blob.${key}: expected a sheet filename - skipped`);
          continue;
        }
        plan.blobs[key] = { file: value, columns, masks };
      }
    }
  }

  const nested = raw.blob47 as Record<string, unknown> | undefined;
  if (!nested || typeof nested !== 'object') return;
  for (const [key, value] of Object.entries(nested)) {
    if (!isTileRole(key)) {
      plan.notes.push(`blob47.${key}: not a tile role - skipped`);
      continue;
    }
    if (typeof value !== 'object' || value === null) {
      plan.notes.push(`blob47.${key}: expected { sheet, masks } - skipped`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    const file =
      typeof entry.sheet === 'string'
        ? entry.sheet
        : typeof entry.file === 'string'
          ? entry.file
          : null;
    const masks = Array.isArray(entry.masks) ? (entry.masks as unknown[]).map(Number) : [];
    if (!file) {
      plan.notes.push(`blob47.${key}: no "sheet" filename - autotiling disabled for this role`);
      continue;
    }
    if (masks.length === 0) {
      plan.notes.push(`blob47.${key}: no mask table - autotiling disabled for this role`);
      continue;
    }
    plan.blobs[key] = {
      file,
      columns: typeof entry.columns === 'number' ? entry.columns : null,
      masks,
    };
  }
}

/**
 * Decorative scatter declared by the pack:
 *
 *   "decals": [{ "file": "bones_01.png", "on": "floor", "density": 0.06 }]
 *
 * Decals never touch the prefab - they are painted from the tile position, so
 * a room stays portable between biomes and every pack decorates it its own way.
 */
function planDecals(raw: Record<string, unknown>, plan: TilesetPlan): void {
  const list = raw.decals;
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    plan.notes.push('decals is not an array - ignored');
    return;
  }
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const d = item as Record<string, unknown>;
    const file = typeof d.file === 'string' ? d.file : null;
    if (!file) {
      plan.notes.push('a decal has no "file" - skipped');
      continue;
    }
    if (!isTileRole(d.on)) {
      plan.notes.push(`${file}: decal "on" must be a tile role - skipped`);
      continue;
    }
    const density = typeof d.density === 'number' ? d.density : 0.05;
    if (!(density > 0)) {
      plan.notes.push(`${file}: decal density must be above zero - skipped`);
      continue;
    }
    const jitter = typeof d.jitter === 'number' ? d.jitter : DEFAULT_DECAL_JITTER;
    plan.decals.push({
      file,
      on: d.on,
      density: Math.min(1, density),
      jitter: Math.max(0, Math.min(0.5, jitter)),
    });
  }
}

/**
 *   "fixtures": { "door_ns": ["door_ns.png"], "gate_ew": ["gate_ew.png"] }
 */
function planFixtures(raw: Record<string, unknown>, plan: TilesetPlan): void {
  const fixtures = raw.fixtures;
  if (fixtures === undefined) return;
  if (typeof fixtures !== 'object' || fixtures === null || Array.isArray(fixtures)) {
    plan.notes.push('fixtures is not an object - ignored');
    return;
  }
  for (const [key, value] of Object.entries(fixtures as Record<string, unknown>)) {
    if (!(FIXTURE_KEYS as readonly string[]).includes(key)) {
      plan.notes.push(`fixtures.${key}: not a known fixture - skipped`);
      continue;
    }
    const files = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : [];
    if (files.length === 0) {
      plan.notes.push(`fixtures.${key}: no filename - skipped`);
      continue;
    }
    plan.fixtures[key as FixtureKey] = files;
  }
}

export function planTileset(raw: unknown): TilesetPlan {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('tiles.json is not an object');
  }
  const manifest = raw as Record<string, unknown>;
  const tileSize =
    (typeof manifest.tileSize === 'number' ? manifest.tileSize : undefined) ??
    (typeof manifest.tile_size === 'number' ? manifest.tile_size : undefined) ??
    32;

  const plan: TilesetPlan = {
    tileSize,
    files: {},
    blobs: {},
    decals: [],
    fixtures: {},
    notes: [],
  };

  if (manifest.roles && typeof manifest.roles === 'object') {
    planFromRolesMap(manifest, plan);
  } else if (Array.isArray(manifest.textures) || Array.isArray(manifest.objects)) {
    planFromSheetManifest(manifest, plan);
  } else {
    throw new Error('tiles.json has neither a "roles" map nor "textures"/"objects" entries');
  }

  planBlobSheets(manifest, plan);
  planDecals(manifest, plan);
  planFixtures(manifest, plan);

  if (
    Object.keys(plan.files).length === 0 &&
    Object.keys(plan.blobs).length === 0 &&
    plan.decals.length === 0 &&
    Object.keys(plan.fixtures).length === 0
  ) {
    throw new Error('tiles.json maps nothing onto a tile role');
  }
  return plan;
}

/** Neighbour bits, as used by blob47 sheets. */
export const BIT = {
  N: 1,
  E: 2,
  S: 4,
  W: 8,
  NE: 16,
  SE: 32,
  SW: 64,
  NW: 128,
} as const;

/**
 * A diagonal only counts when both of its orthogonal neighbours are present.
 * That reduction is what turns 256 raw combinations into the canonical 47.
 */
export function canonicalMask(raw: number): number {
  let mask = raw & (BIT.N | BIT.E | BIT.S | BIT.W);
  if (raw & BIT.NE && mask & BIT.N && mask & BIT.E) mask |= BIT.NE;
  if (raw & BIT.SE && mask & BIT.S && mask & BIT.E) mask |= BIT.SE;
  if (raw & BIT.SW && mask & BIT.S && mask & BIT.W) mask |= BIT.SW;
  if (raw & BIT.NW && mask & BIT.N && mask & BIT.W) mask |= BIT.NW;
  return mask;
}

/**
 * Neighbour mask for the tile at (x, y).
 * `same` answers whether a neighbour counts as the same terrain; tiles outside
 * the room use `outsideCounts`.
 */
export function neighbourMask(
  x: number,
  y: number,
  w: number,
  h: number,
  same: (x: number, y: number) => boolean,
  outsideCounts: boolean,
): number {
  const at = (nx: number, ny: number): boolean => {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return outsideCounts;
    return same(nx, ny);
  };
  let raw = 0;
  if (at(x, y - 1)) raw |= BIT.N;
  if (at(x + 1, y)) raw |= BIT.E;
  if (at(x, y + 1)) raw |= BIT.S;
  if (at(x - 1, y)) raw |= BIT.W;
  if (at(x + 1, y - 1)) raw |= BIT.NE;
  if (at(x + 1, y + 1)) raw |= BIT.SE;
  if (at(x - 1, y + 1)) raw |= BIT.SW;
  if (at(x - 1, y - 1)) raw |= BIT.NW;
  return canonicalMask(raw);
}
