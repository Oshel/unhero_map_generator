import type { ExitSide, Markers, RoomRole, Size } from '../types/prefab';
import type { PrefabMeta, RoomDoc } from '../types/editor';
import { emptyMarkers } from '../types/editor';
import { mulberry32, type Rng } from '../core/rng';
import { makeLayers } from '../core/grid';
import { floodFill } from '../core/floodfill';
import { passabilityMask } from '../core/passability';
import { EXIT_WIDTH, GATE_WIDTH } from '../gen/constants';
import { generateRoom } from '../gen/generate';
import { defaultParams, type ExitConfig, type GenParams } from '../gen/params';
import { SUBBIOME_PROFILES } from '../gen/profiles';
import type { CheckResult } from '../validate/rules';
import {
  MAX_CELL,
  MAX_MAP_ATTEMPTS,
  MIN_CELL,
  MIXED_PROFILE_ID,
  type MapDoc,
  type MapLink,
  type MapParams,
  type MapPortal,
  type MapReport,
  type MapResult,
  type PlacedRoom,
} from './types';

/**
 * A cell of the room grid, before its interior exists. Doors are decided here,
 * on the shared walls, and only then does each room get generated with those
 * doors pinned - the interior is built to serve the layout, not the other way
 * round.
 */
interface Cell {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  role: RoomRole;
  /** Offset along each side where a door goes, in room-local tiles. */
  doors: Partial<Record<ExitSide, { offset: number; width: number }>>;
}

export interface Grid {
  cols: number;
  rows: number;
  cell: Size;
  cells: Cell[];
}

function opposite(side: ExitSide): ExitSide {
  return side === 'n' ? 's' : side === 's' ? 'n' : side === 'e' ? 'w' : 'e';
}

/** The cell size: yours when fixed, rolled from the seed otherwise. */
export function cellSize(params: MapParams, rng: Rng): Size {
  if (params.roomSize.mode === 'fixed') {
    return {
      w: Math.max(MIN_CELL, Math.min(MAX_CELL, Math.round(params.roomSize.w))),
      h: Math.max(MIN_CELL, Math.min(MAX_CELL, Math.round(params.roomSize.h))),
    };
  }
  return { w: rng.int(8, 16) * 2, h: rng.int(7, 14) * 2 };
}

/** Rooms tile the map edge to edge: 300 wide with a 30 wide cell is ten rooms. */
export function buildGrid(size: Size, cell: Size): Grid {
  const cols = Math.max(1, Math.floor(size.w / cell.w));
  const rows = Math.max(1, Math.floor(size.h / cell.h));
  // Centre the grid so the leftovers sit as an even margin on each side.
  const originX = Math.floor((size.w - cols * cell.w) / 2);
  const originY = Math.floor((size.h - rows * cell.h) / 2);
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        index: row * cols + col,
        col,
        row,
        x: originX + col * cell.w,
        y: originY + row * cell.h,
        w: cell.w,
        h: cell.h,
        role: 'normal',
        doors: {},
      });
    }
  }
  return { cols, rows, cell, cells };
}

interface Edge {
  a: number;
  b: number;
  /** Side of `a` that faces `b`. */
  side: ExitSide;
}

function gridEdges(grid: Grid): Edge[] {
  const edges: Edge[] = [];
  for (const cell of grid.cells) {
    if (cell.col + 1 < grid.cols) edges.push({ a: cell.index, b: cell.index + 1, side: 'e' });
    if (cell.row + 1 < grid.rows) {
      edges.push({ a: cell.index, b: cell.index + grid.cols, side: 's' });
    }
  }
  return edges;
}

/**
 * A random spanning tree over the grid, so every room is reachable. Randomised
 * Prim rather than a sweep, or the dungeon comes out looking like a comb.
 */
function spanningEdges(grid: Grid, edges: Edge[], rng: Rng): Edge[] {
  const byCell = new Map<number, Edge[]>();
  for (const edge of edges) {
    for (const key of [edge.a, edge.b]) {
      const list = byCell.get(key) ?? [];
      list.push(edge);
      byCell.set(key, list);
    }
  }
  const start = rng.int(0, grid.cells.length - 1);
  const inTree = new Set<number>([start]);
  const chosen: Edge[] = [];
  const frontier: Edge[] = [...(byCell.get(start) ?? [])];
  while (inTree.size < grid.cells.length && frontier.length > 0) {
    const edge = frontier.splice(rng.int(0, frontier.length - 1), 1)[0];
    const next = inTree.has(edge.a) ? edge.b : inTree.has(edge.b) ? edge.a : -1;
    if (next === -1 || inTree.has(next)) continue;
    inTree.add(next);
    chosen.push(edge);
    for (const e of byCell.get(next) ?? []) {
      if (!inTree.has(e.a) || !inTree.has(e.b)) frontier.push(e);
    }
  }
  return chosen;
}

/** Where on the shared wall the door goes, in tiles local to each room. */
function doorOffsets(a: Cell, b: Cell, side: ExitSide, rng: Rng): [number, number] | null {
  if (side === 'e' || side === 'w') {
    // Vertical wall: pick a row both rooms share, clear of their corners.
    const lo = Math.max(a.y + 1, b.y + 1);
    const hi = Math.min(a.y + a.h - 2, b.y + b.h - 2) - (EXIT_WIDTH - 1);
    if (hi < lo) return null;
    const y = rng.int(lo, hi);
    return [y - a.y, y - b.y];
  }
  const lo = Math.max(a.x + 1, b.x + 1);
  const hi = Math.min(a.x + a.w - 2, b.x + b.w - 2) - (EXIT_WIDTH - 1);
  if (hi < lo) return null;
  const x = rng.int(lo, hi);
  return [x - a.x, x - b.x];
}

/** Map tiles a door occupies: one tile in each of the two rooms. */
function doorTiles(a: Cell, side: ExitSide, offsetA: number): Array<[number, number]> {
  const tiles: Array<[number, number]> = [];
  for (let i = 0; i < EXIT_WIDTH; i++) {
    switch (side) {
      case 'e':
        tiles.push([a.x + a.w - 1, a.y + offsetA + i], [a.x + a.w, a.y + offsetA + i]);
        break;
      case 'w':
        tiles.push([a.x, a.y + offsetA + i], [a.x - 1, a.y + offsetA + i]);
        break;
      case 's':
        tiles.push([a.x + offsetA + i, a.y + a.h - 1], [a.x + offsetA + i, a.y + a.h]);
        break;
      case 'n':
        tiles.push([a.x + offsetA + i, a.y], [a.x + offsetA + i, a.y - 1]);
        break;
    }
  }
  return tiles;
}

/** Rooms on the rim of the grid, the only ones a gate can reach. */
function rimCells(grid: Grid): Cell[] {
  return grid.cells.filter(
    (c) => c.col === 0 || c.row === 0 || c.col === grid.cols - 1 || c.row === grid.rows - 1,
  );
}

function outwardSide(grid: Grid, cell: Cell): ExitSide | null {
  const options: ExitSide[] = [];
  if (cell.row === 0) options.push('n');
  if (cell.row === grid.rows - 1) options.push('s');
  if (cell.col === 0) options.push('w');
  if (cell.col === grid.cols - 1) options.push('e');
  return options.find((side) => cell.doors[side] === undefined) ?? null;
}

/** Breadth-first distance over the door graph, in rooms. */
function distances(grid: Grid, links: Edge[], from: number): number[] {
  const adjacency = new Map<number, number[]>();
  for (const link of links) {
    adjacency.set(link.a, [...(adjacency.get(link.a) ?? []), link.b]);
    adjacency.set(link.b, [...(adjacency.get(link.b) ?? []), link.a]);
  }
  const dist = new Array<number>(grid.cells.length).fill(-1);
  dist[from] = 0;
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    for (const next of adjacency.get(current) ?? []) {
      if (dist[next] !== -1) continue;
      dist[next] = dist[current] + 1;
      queue.push(next);
    }
  }
  return dist;
}

function buildOnce(params: MapParams, seed: number, meta: PrefabMeta): MapResult | null {
  const rng = mulberry32(seed);
  const size = { ...params.size };
  const cell = cellSize(params, rng);
  const grid = buildGrid(size, cell);
  if (grid.cells.length < 2) return null;

  // 1. Doors first, on the walls the rooms share. A spanning tree guarantees the
  //    dungeon is walkable; loopiness decides how many extra doors go in.
  const edges = gridEdges(grid);
  const tree = spanningEdges(grid, edges, rng);
  const key = (e: Edge): string => `${e.a}-${e.b}`;
  const chosen = new Set(tree.map(key));
  const extras = Math.round((edges.length - tree.length) * (params.loopiness / 100));
  for (const edge of rng.shuffle(edges)) {
    if (chosen.size >= tree.length + extras) break;
    chosen.add(key(edge));
  }
  const wanted = edges.filter((e) => chosen.has(key(e)));

  const links: MapLink[] = [];
  for (const edge of wanted) {
    const a = grid.cells[edge.a];
    const b = grid.cells[edge.b];
    const offsets = doorOffsets(a, b, edge.side, rng);
    if (!offsets) continue;
    const [offsetA, offsetB] = offsets;
    a.doors[edge.side] = { offset: offsetA, width: EXIT_WIDTH };
    b.doors[opposite(edge.side)] = { offset: offsetB, width: EXIT_WIDTH };
    links.push({
      from: edge.a,
      to: edge.b,
      side: edge.side,
      tiles: doorTiles(a, edge.side, offsetA),
    });
  }

  // 2. Gates: the way in, and the way out of the final arena, both on the rim.
  const rim = rimCells(grid);
  if (rim.length < 2) return null;
  const entranceCell = rng.pick(rim);
  const dist = distances(grid, wanted, entranceCell.index);
  let exitCell = entranceCell;
  let best = -1;
  for (const candidate of rim) {
    if (candidate.index === entranceCell.index) continue;
    if (dist[candidate.index] > best) {
      best = dist[candidate.index];
      exitCell = candidate;
    }
  }
  if (exitCell.index === entranceCell.index || best < 1) return null;

  entranceCell.role = 'entrance';
  exitCell.role = 'arena';
  let treasureLeft = Math.min(3, Math.floor(grid.cells.length / 8));
  for (const c of grid.cells) {
    if (c.role !== 'normal' || treasureLeft <= 0) continue;
    if (rng.chance(0.12)) {
      c.role = 'treasure';
      treasureLeft--;
    }
  }

  const gatePlans: Array<{ kind: 'entrance' | 'exit'; cell: Cell; side: ExitSide; offset: number }> =
    [];
  for (const [kind, c] of [
    ['entrance', entranceCell],
    ['exit', exitCell],
  ] as Array<['entrance' | 'exit', Cell]>) {
    const side = outwardSide(grid, c);
    if (!side) return null;
    const span = side === 'n' || side === 's' ? c.w : c.h;
    const offset = Math.max(
      1,
      Math.min(span - GATE_WIDTH - 1, Math.floor(span / 2) + rng.int(-2, 2)),
    );
    c.doors[side] = { offset, width: GATE_WIDTH };
    gatePlans.push({ kind, cell: c, side, offset });
  }

  // 3. Rooms, each generated with every door of its cell already pinned.
  const base = defaultParams();
  const rooms: PlacedRoom[] = [];
  for (const c of grid.cells) {
    const sides = {} as Record<ExitSide, ExitConfig>;
    for (const side of ['n', 'e', 's', 'w'] as ExitSide[]) {
      const door = c.doors[side];
      sides[side] = {
        enabled: door !== undefined,
        width: (door?.width ?? EXIT_WIDTH) as ExitConfig['width'],
        type: rng.chance(0.55) ? 'open' : 'door',
        offset: door?.offset ?? null,
      };
    }
    const profile =
      params.profile === MIXED_PROFILE_ID ? rng.pick(SUBBIOME_PROFILES).id : params.profile;
    const roomParams: GenParams = {
      ...base,
      size: { w: c.w, h: c.h },
      roomRole: c.role,
      profile,
      exits: { auto: false, sides },
      markers: { ...params.markers },
    };
    const result = generateRoom(roomParams, rng.int(1, 0x3fffffff), {
      ...meta,
      id: `${meta.id}_r${c.row}c${c.col}`,
    });
    if (!result.report.ok) return null;
    rooms.push({
      index: c.index,
      col: c.col,
      row: c.row,
      profile,
      x: c.x,
      y: c.y,
      doc: result.doc,
      role: c.role,
      style: result.resolved.style,
      claustrophobia: result.resolved.claustrophobia,
    });
  }

  // 4. Compose the rooms into one map.
  const layers = makeLayers(size.w, size.h);
  const markers: Markers = emptyMarkers();
  for (const room of rooms) {
    for (let y = 0; y < room.doc.size.h; y++) {
      for (let x = 0; x < room.doc.size.w; x++) {
        const mx = room.x + x;
        const my = room.y + y;
        if (mx < 0 || my < 0 || mx >= size.w || my >= size.h) continue;
        layers.ground[my][mx] = room.doc.layers.ground[y][x];
        layers.blocking[my][mx] = room.doc.layers.blocking[y][x];
        layers.deco[my][mx] = room.doc.layers.deco[y][x];
        layers.overlay[my][mx] = room.doc.layers.overlay[y][x];
      }
    }
    for (const m of room.doc.markers.spawn)
      markers.spawn.push({ ...m, x: m.x + room.x, y: m.y + room.y });
    for (const m of room.doc.markers.loot)
      markers.loot.push({ ...m, x: m.x + room.x, y: m.y + room.y });
    for (const m of room.doc.markers.prop)
      markers.prop.push({ ...m, x: m.x + room.x, y: m.y + room.y });
    for (const m of room.doc.markers.objective)
      markers.objective.push({ ...m, x: m.x + room.x, y: m.y + room.y });
    for (const m of room.doc.markers.light)
      markers.light.push({ ...m, x: m.x + room.x, y: m.y + room.y });
  }

  // 5. Gates run from their room out to the map edge.
  const portals: MapPortal[] = gatePlans.map((plan) => {
    const tiles: Array<[number, number]> = [];
    const carve = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= size.w || y >= size.h) return;
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'void';
      tiles.push([x, y]);
    };
    const c = plan.cell;
    for (let i = 0; i < GATE_WIDTH; i++) {
      switch (plan.side) {
        case 'n':
          for (let y = 0; y <= c.y; y++) carve(c.x + plan.offset + i, y);
          break;
        case 's':
          for (let y = c.y + c.h - 1; y < size.h; y++) carve(c.x + plan.offset + i, y);
          break;
        case 'w':
          for (let x = 0; x <= c.x; x++) carve(x, c.y + plan.offset + i);
          break;
        case 'e':
          for (let x = c.x + c.w - 1; x < size.w; x++) carve(x, c.y + plan.offset + i);
          break;
      }
    }
    return { kind: plan.kind, room: c.index, side: plan.side, tiles };
  });

  const doc: MapDoc = {
    size,
    decorSeed: rng.int(0, 0x3fffffff),
    cols: grid.cols,
    rows: grid.rows,
    cell,
    entranceRoom: entranceCell.index,
    exitRoom: exitCell.index,
    portals,
    layers,
    markers,
    rooms,
    links,
  };
  return { doc, seed, attempts: 1, report: validateMap(doc) };
}

/** Every room has to be reachable from the entrance - that is the whole point. */
export function validateMap(doc: MapDoc): MapReport {
  const passable = passabilityMask(doc.layers);
  const start = doc.rooms.find((r) => r.index === doc.entranceRoom) ?? doc.rooms[0];
  const seeds: Array<[number, number]> = [];
  if (start) {
    for (let y = 1; y < start.doc.size.h - 1 && seeds.length === 0; y++) {
      for (let x = 1; x < start.doc.size.w - 1 && seeds.length === 0; x++) {
        const mx = start.x + x;
        const my = start.y + y;
        if (passable.mask[my * doc.size.w + mx]) seeds.push([mx, my]);
      }
    }
  }
  const reached =
    seeds.length > 0 ? floodFill(passable, seeds) : new Uint8Array(passable.mask.length);

  const unreachable: Array<[number, number]> = [];
  let reachedRooms = 0;
  for (const room of doc.rooms) {
    let any = false;
    for (let y = 0; y < room.doc.size.h && !any; y++) {
      for (let x = 0; x < room.doc.size.w && !any; x++) {
        const i = (room.y + y) * doc.size.w + (room.x + x);
        if (reached[i]) any = true;
      }
    }
    if (any) reachedRooms++;
    else
      unreachable.push([
        room.x + Math.floor(room.doc.size.w / 2),
        room.y + Math.floor(room.doc.size.h / 2),
      ]);
  }

  const orphanTiles: Array<[number, number]> = [];
  for (let y = 0; y < doc.size.h; y++) {
    for (let x = 0; x < doc.size.w; x++) {
      const i = y * doc.size.w + x;
      if (passable.mask[i] && !reached[i]) orphanTiles.push([x, y]);
    }
  }

  const portalTiles = (kind: 'entrance' | 'exit'): Array<[number, number]> =>
    doc.portals.filter((p) => p.kind === kind).flatMap((p) => p.tiles);
  const entranceTiles = portalTiles('entrance');
  const exitTilesList = portalTiles('exit');
  const exitReachable = exitTilesList.some(([x, y]) => reached[y * doc.size.w + x]);
  const arenaAtExit = doc.rooms.find((r) => r.index === doc.exitRoom)?.role === 'arena';

  const linked = new Set<number>();
  for (const link of doc.links) {
    linked.add(link.from);
    linked.add(link.to);
  }
  const unlinked = doc.rooms.filter((r) => !linked.has(r.index));

  const checks: CheckResult[] = [
    {
      id: 'map_portals',
      label: 'One way in, one way out',
      ok: entranceTiles.length > 0 && exitTilesList.length > 0 && exitReachable && arenaAtExit,
      message:
        entranceTiles.length === 0
          ? 'no entrance to the map edge'
          : exitTilesList.length === 0
            ? 'no exit to the map edge'
            : !exitReachable
              ? 'the exit cannot be walked to from the entrance'
              : !arenaAtExit
                ? 'the exit is not in an arena'
                : 'entrance and exit reach the map edge, the exit sits in the final arena',
      tiles: exitReachable ? [] : exitTilesList,
    },
    {
      id: 'map_rooms_reachable',
      label: 'Every room reachable from the entrance',
      ok: unreachable.length === 0,
      message:
        unreachable.length === 0
          ? `${reachedRooms} room(s) all connected`
          : `${unreachable.length} room(s) cut off`,
      tiles: unreachable,
    },
    {
      id: 'map_no_orphans',
      label: 'No walkable tile stranded',
      ok: orphanTiles.length === 0,
      message:
        orphanTiles.length === 0
          ? 'The whole map is one region'
          : `${orphanTiles.length} walkable tile(s) unreachable`,
      tiles: orphanTiles.slice(0, 400),
    },
    {
      id: 'map_links',
      label: 'Every room has a door',
      ok: unlinked.length === 0,
      message:
        unlinked.length === 0
          ? `${doc.links.length} door(s) between rooms`
          : `${unlinked.length} room(s) with no door`,
      tiles: unlinked.map((r) => [r.x, r.y] as [number, number]),
    },
  ];

  return { ok: checks.every((c) => c.ok), checks };
}

/** Generate a whole map, retrying with seed + 1 until it holds together. */
export function generateMap(params: MapParams, seed: number, meta: PrefabMeta): MapResult {
  let fallback: MapResult | null = null;
  for (let attempt = 0; attempt < MAX_MAP_ATTEMPTS; attempt++) {
    const trySeed = (seed + attempt) >>> 0;
    const result = buildOnce(params, trySeed, meta);
    if (result) {
      const stamped = { ...result, seed: trySeed, attempts: attempt + 1 };
      if (stamped.report.ok) return stamped;
      if (!fallback) fallback = stamped;
    }
  }
  if (fallback) return { ...fallback, attempts: MAX_MAP_ATTEMPTS };
  const layers = makeLayers(params.size.w, params.size.h);
  const doc: MapDoc = {
    size: { ...params.size },
    decorSeed: 0,
    cols: 0,
    rows: 0,
    cell: { w: 0, h: 0 },
    entranceRoom: 0,
    exitRoom: 0,
    portals: [],
    layers,
    markers: emptyMarkers(),
    rooms: [],
    links: [],
  };
  return { doc, seed, attempts: MAX_MAP_ATTEMPTS, report: validateMap(doc) };
}

/** The map as something the canvas and the JSON preview can treat like a room. */
export function mapToDoc(map: MapDoc, meta: PrefabMeta): RoomDoc {
  return {
    size: map.size,
    decorSeed: map.decorSeed,
    meta,
    exits: [],
    doors: [],
    layers: map.layers,
    markers: map.markers,
  };
}

/**
 * Every door and gate on the map. Doors belong to the sub-rooms inside a room;
 * the openings between rooms are plain two-tile gaps with nothing in them.
 */
export function mapFixtures(
  map: MapDoc,
): Array<{ kind: 'door' | 'gate'; orientation: 'ns' | 'ew'; x: number; y: number }> {
  const out: Array<{ kind: 'door' | 'gate'; orientation: 'ns' | 'ew'; x: number; y: number }> = [];
  for (const room of map.rooms) {
    for (const door of room.doc.doors) {
      out.push({ kind: 'door', orientation: door.axis, x: room.x + door.x, y: room.y + door.y });
    }
  }
  for (const portal of map.portals) {
    if (portal.tiles.length === 0) continue;
    const vertical = portal.side === 'n' || portal.side === 's';
    const xs = portal.tiles.map(([x]) => x);
    const ys = portal.tiles.map(([, y]) => y);
    out.push({
      kind: 'gate',
      orientation: vertical ? 'ns' : 'ew',
      x: vertical ? Math.min(...xs) : portal.side === 'w' ? Math.min(...xs) : Math.max(...xs),
      y: vertical ? (portal.side === 'n' ? Math.min(...ys) : Math.max(...ys)) : Math.min(...ys),
    });
  }
  return out;
}
