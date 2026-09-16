import type {
  Exit,
  ExitSide,
  ExitType,
  ExitWidth,
  LayerName,
  Layers,
  Markers,
  RoomDoor,
  RoomRole,
  TileGrid,
  TileRole,
} from '../types/prefab';
import {
  EXIT_SIDES,
  EXIT_TILE_WIDTH,
  EXIT_TYPES,
  GATE_TILE_WIDTH,
  LAYER_NAMES,
  ROOM_ROLES,
  SPAWN_TIERS,
  TILE_ROLES,
} from '../types/prefab';
import type { RoomDoc } from '../types/editor';
import { emptyMarkers } from '../types/editor';
import { makeGrid } from '../core/grid';

export class ImportError extends Error {}

function fail(msg: string): never {
  throw new ImportError(msg);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function asInt(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${what} is not a number`);
  return Math.round(value as number);
}

function asStringArray(value: unknown, what: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${what} is not an array`);
  return value.map((v) => String(v));
}

function parseGrid(value: unknown, w: number, h: number, what: string): TileGrid {
  if (value === undefined) return makeGrid(w, h, 'void');
  if (!Array.isArray(value) || value.length !== h) fail(`${what} must have ${h} rows`);
  return value.map((row, y) => {
    if (!Array.isArray(row) || row.length !== w) fail(`${what} row ${y} must have ${w} tiles`);
    return row.map((cell, x) => {
      if (!TILE_ROLES.includes(cell as TileRole)) fail(`${what}[${y}][${x}]: unknown role "${cell}"`);
      return cell as TileRole;
    });
  });
}

function parseExits(value: unknown): Exit[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('exits is not an array');
  return value.map((raw, i) => {
    const e = asRecord(raw, `exits[${i}]`);
    const side = e.side as ExitSide;
    if (!EXIT_SIDES.includes(side)) fail(`exits[${i}].side must be n/e/s/w`);
    // A doorway is 1 tile, a map gate is 2. Anything else is an older prefab.
    const width = e.width === undefined ? EXIT_TILE_WIDTH : asInt(e.width, `exits[${i}].width`);
    if (width !== EXIT_TILE_WIDTH && width !== GATE_TILE_WIDTH) {
      fail(
        `exits[${i}].width is ${width}; a door is ${EXIT_TILE_WIDTH} tile and a gate is ${GATE_TILE_WIDTH}`,
      );
    }
    const type = (e.type ?? 'open') as ExitType;
    if (!EXIT_TYPES.includes(type)) fail(`exits[${i}].type is not a known exit type`);
    return {
      side,
      offset: asInt(e.offset, `exits[${i}].offset`),
      width: width as ExitWidth,
      type,
    };
  });
}

function parseMarkers(value: unknown): Markers {
  const markers = emptyMarkers();
  if (value === undefined) return markers;
  const m = asRecord(value, 'markers');

  for (const raw of (m.spawn as unknown[]) ?? []) {
    const s = asRecord(raw, 'markers.spawn[]');
    const tier = (s.tier ?? 'normal') as (typeof SPAWN_TIERS)[number];
    markers.spawn.push({
      x: asInt(s.x, 'spawn.x'),
      y: asInt(s.y, 'spawn.y'),
      tier: SPAWN_TIERS.includes(tier) ? tier : 'normal',
    });
  }
  for (const raw of (m.loot as unknown[]) ?? []) {
    const s = asRecord(raw, 'markers.loot[]');
    markers.loot.push({ x: asInt(s.x, 'loot.x'), y: asInt(s.y, 'loot.y') });
  }
  for (const raw of (m.prop as unknown[]) ?? []) {
    const s = asRecord(raw, 'markers.prop[]');
    markers.prop.push({
      x: asInt(s.x, 'prop.x'),
      y: asInt(s.y, 'prop.y'),
      kind: String(s.kind ?? 'barrel'),
    });
  }
  for (const raw of (m.objective as unknown[]) ?? []) {
    const s = asRecord(raw, 'markers.objective[]');
    markers.objective.push({ x: asInt(s.x, 'objective.x'), y: asInt(s.y, 'objective.y') });
  }
  for (const raw of (m.light as unknown[]) ?? []) {
    const s = asRecord(raw, 'markers.light[]');
    markers.light.push({
      x: asInt(s.x, 'light.x'),
      y: asInt(s.y, 'light.y'),
      radius: asInt(s.radius ?? 6, 'light.radius'),
    });
  }
  return markers;
}

function parseDoors(value: unknown): RoomDoor[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('doors is not an array');
  return value.map((raw, i) => {
    const d = asRecord(raw, `doors[${i}]`);
    const axis = d.axis === 'ew' ? 'ew' : 'ns';
    return { x: asInt(d.x, `doors[${i}].x`), y: asInt(d.y, `doors[${i}].y`), axis };
  });
}

/** Parse a prefab JSON file into an editable document. Throws ImportError. */
export function parsePrefab(text: string): RoomDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    fail(`not valid JSON: ${(err as Error).message}`);
  }
  const root = asRecord(raw, 'prefab');
  const size = asRecord(root.size, 'size');
  const w = asInt(size.w, 'size.w');
  const h = asInt(size.h, 'size.h');
  if (w < 1 || h < 1) fail('size must be positive');

  const role = (root.role ?? 'normal') as RoomRole;
  if (!ROOM_ROLES.includes(role)) fail(`role "${String(root.role)}" is not a room role`);

  const layersRaw = root.layers === undefined ? {} : asRecord(root.layers, 'layers');
  const layers = Object.fromEntries(
    LAYER_NAMES.map((name: LayerName) => [name, parseGrid(layersRaw[name], w, h, `layers.${name}`)]),
  ) as unknown as Layers;

  return {
    size: { w, h },
    decorSeed: root.decor_seed === undefined ? 0 : asInt(root.decor_seed, 'decor_seed'),
    meta: {
      id: String(root.id ?? 'imported_room'),
      role,
      biome_tags: asStringArray(root.biome_tags, 'biome_tags'),
      subbiome_tags: asStringArray(root.subbiome_tags, 'subbiome_tags'),
      weight: root.weight === undefined ? 10 : asInt(root.weight, 'weight'),
      constraints: {
        min_depth: asInt(asRecord(root.constraints ?? { min_depth: 0 }, 'constraints').min_depth ?? 0, 'constraints.min_depth'),
        max_per_level: asInt(
          asRecord(root.constraints ?? { max_per_level: 1 }, 'constraints').max_per_level ?? 1,
          'constraints.max_per_level',
        ),
        min_players: asInt(
          asRecord(root.constraints ?? { min_players: 1 }, 'constraints').min_players ?? 1,
          'constraints.min_players',
        ),
      },
    },
    exits: parseExits(root.exits),
    doors: parseDoors(root.doors),
    layers,
    markers: parseMarkers(root.markers),
  };
}
