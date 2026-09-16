import type { Exit, ExitSide, Layers, RoomDoor, Size } from '../types/prefab';
import { EXIT_SIDES } from '../types/prefab';
import type { PrefabMeta, RoomDoc } from '../types/editor';
import { makeLayers } from '../core/grid';
import { floodFill } from '../core/floodfill';
import { largestComponent } from '../core/floodfill';
import { passabilityMask } from '../core/passability';
import { mulberry32 } from '../core/rng';
import { validateRoom, type ValidationReport } from '../validate/validate';
import { placeMarkers } from './markers';
import {
  buildShell,
  carveRect,
  clampToInterior,
  exitAnchor,
  exitTiles,
  markRect,
  sideLength,
} from './outline';
import { EXIT_WIDTH, MAX_CORRIDOR_WIDTH, MAX_GEN_ATTEMPTS } from './constants';
import { pickExits } from './exits';
import { resolveParams, STYLE_MODE, type GenParams, type ResolvedParams } from './params';
import { STYLE_REGISTRY } from './styles';
import { dryUnderBlocking, liquidPass } from './water';

export interface GenResult {
  doc: RoomDoc;
  /** Densities the seed rolled for this room. */
  resolved: ResolvedParams;
  /** Seed that actually produced this room (may differ after retries). */
  seed: number;
  attempts: number;
  report: ValidationReport;
}

/**
 * Offsets along each side where an opening of the given width would land
 * straight in walkable floor - a chamber or a corridor standing against the
 * room's own wall.
 */
export type Openings = Record<ExitSide, number[]>;

/**
 * A room before it has any way in or out.
 *
 * Exits used to be decided first and the interior built to serve them, which
 * meant every doorway needed a passage dug from the wall to whatever was
 * behind it - so you entered every room down a stub of corridor. It is the
 * other way round now: the layout is built first and says where an opening
 * would work, and only then is the wall breached. A map can therefore hang its
 * doors where both neighbours already have a room against the wall.
 */
export interface RoomInterior {
  size: Size;
  layers: Layers;
  doors: RoomDoor[];
  resolved: ResolvedParams;
  seed: number;
  /** Rects the style had to leave walkable, carved after it ran. */
  protectedRects: Array<[number, number, number, number]>;
  openings: Openings;
}

/** The stages share a seed, so each salts it apart before rolling anything. */
const FINISH_SALT = 0x5bf03635;
const EXIT_SALT = 0x27d4eb2d;

/** The tile just inside the wall, on the given side. */
function insideOf(size: Size, side: ExitSide, offset: number, step: number): [number, number] {
  switch (side) {
    case 'n':
      return [offset, step];
    case 's':
      return [offset, size.h - 1 - step];
    case 'w':
      return [step, offset];
    default:
      return [size.w - 1 - step, offset];
  }
}

/**
 * Somewhere the player can end up standing. Furniture counts: a crate against
 * the wall is not a reason to dig a tunnel round it, it is a crate to move out
 * of the doorway, and the opening pass clears it.
 */
function isEnterable(layers: Layers, x: number, y: number): boolean {
  return layers.blocking[y][x] !== 'wall' && layers.ground[y][x] === 'floor';
}

/**
 * Where an opening of `width` would put the player straight on open floor.
 *
 * Read off the finished layout, one tile in from the wall: if every tile behind
 * the opening is walkable, the wall there is the wall of something you can
 * stand in, and a doorway can simply be punched through it.
 */
export function openingsOf(layers: Layers, size: Size, width: number): Openings {
  const openings = { n: [], e: [], s: [], w: [] } as Openings;
  for (const side of EXIT_SIDES) {
    const span = sideLength(size, side);
    for (let offset = 1; offset <= span - width - 1; offset++) {
      let ok = true;
      for (let i = 0; i < width && ok; i++) {
        const [x, y] = insideOf(size, side, offset + i, 1);
        if (!isEnterable(layers, x, y)) ok = false;
      }
      if (ok) openings[side].push(offset);
    }
  }
  return openings;
}

/**
 * The one thing the interior owes the room before it knows its exits: somewhere
 * open in the middle. A subtractive style digs its own corridors and needs no
 * help; an additive one would otherwise be obstacles wall to wall.
 */
function centralHall(
  size: Size,
  resolved: ResolvedParams,
): { mask: Uint8Array; rects: Array<[number, number, number, number]> } {
  const mask = new Uint8Array(size.w * size.h);
  const rects: Array<[number, number, number, number]> = [];
  if (STYLE_MODE[resolved.style] !== 'subtractive') {
    const half = MAX_CORRIDOR_WIDTH - 1;
    const cx = Math.floor(size.w / 2);
    const cy = Math.floor(size.h / 2);
    rects.push(clampToInterior(size, [cx - half, cy - half, cx + half, cy + half]));
  }
  for (const [x0, y0, x1, y1] of rects) markRect(mask, size, x0, y0, x1, y1);
  return { mask, rects };
}

/** Stage one: the layout, and what it offers as a way in. */
export function buildInterior(params: GenParams, seed: number): RoomInterior {
  const rng = mulberry32(seed);
  const resolved = resolveParams(params, rng, []);
  const size: Size = { w: params.size.w, h: params.size.h };
  const layers = makeLayers(size.w, size.h);

  buildShell(layers, size);
  const protectedArea = centralHall(size, resolved);
  // Styles that build sub-rooms report their doorways here.
  const doors: RoomDoor[] = [];
  STYLE_REGISTRY[resolved.style]({
    size,
    layers,
    exits: [],
    protectedMask: protectedArea.mask,
    rng,
    params,
    resolved,
    doors,
  });
  // Carved last so nothing the style did can close it.
  for (const [x0, y0, x1, y1] of protectedArea.rects) carveRect(layers, size, x0, y0, x1, y1);

  return {
    size,
    layers,
    doors,
    resolved,
    seed,
    protectedRects: protectedArea.rects,
    openings: openingsOf(layers, size, EXIT_WIDTH),
  };
}

/**
 * Breach the wall, and only dig if there is nothing behind it yet. An opening
 * the layout offered lands in a chamber and costs one tile; anywhere else the
 * passage goes straight in until it meets open floor.
 */
function openExits(layers: Layers, size: Size, exits: Exit[]): Uint8Array {
  const mask = new Uint8Array(size.w * size.h);
  const depth = (side: ExitSide): number =>
    (side === 'n' || side === 's' ? size.h : size.w) - 2;

  for (const exit of exits) {
    for (const [x, y] of exitTiles(size, exit)) {
      carveRect(layers, size, x, y, x, y);
      mask[y * size.w + x] = 1;
    }
    for (let step = 1; step < depth(exit.side); step++) {
      const tiles: Array<[number, number]> = [];
      for (let i = 0; i < exit.width; i++) {
        tiles.push(insideOf(size, exit.side, exit.offset + i, step));
      }
      // Whatever is here is cleared either way - the difference is whether the
      // digging goes on. Arriving means the room was already open at this tile.
      const arrived = tiles.every(([x, y]) => isEnterable(layers, x, y));
      for (const [x, y] of tiles) {
        carveRect(layers, size, x, y, x, y);
        mask[y * size.w + x] = 1;
      }
      if (arrived) break;
    }
  }
  return mask;
}

/**
 * Fill in everything no exit can reach. A style can easily leave an island
 * behind - a walled-off cell, a cave chamber the automaton cut loose - and an
 * island is dead space: the player never sees it, but the game still decorates
 * and spawns around it.
 *
 * Pits and water need the same treatment for a different reason. Neither is
 * passable, so neither is ever part of a walkable pocket, and walling off the
 * floor around a pond leaves the pond itself standing: a hole in the middle of
 * solid rock with no edge to fall off. A pond is only a pond if you can reach
 * its bank, so it is judged whole - one tile of shore keeps all of it.
 */
function sealPockets(layers: Layers, size: Size, exits: Exit[]): void {
  const passable = passabilityMask(layers);
  const seeds = exits.map((exit) => exitAnchor(size, exit));
  let reached: Uint8Array;
  if (seeds.length > 0) {
    reached = floodFill(passable, seeds);
  } else {
    // No exits: keep the biggest region and drop the rest.
    const { labels, label } = largestComponent(passable);
    reached = new Uint8Array(passable.mask.length);
    for (let i = 0; i < labels.length; i++) if (labels[i] === label) reached[i] = 1;
  }
  const fillIn = (x: number, y: number): void => {
    layers.blocking[y][x] = 'wall';
    layers.ground[y][x] = 'floor';
  };
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) {
      const i = y * size.w + x;
      if (!passable.mask[i] || reached[i]) continue;
      fillIn(x, y);
    }
  }

  // Second pass, after the first has decided which floor survives: a pond is
  // worth keeping only if there is still somewhere to stand beside it.
  const isPool = (x: number, y: number): boolean => {
    if (layers.blocking[y][x] !== 'void') return false;
    const ground = layers.ground[y][x];
    return (
      (ground === 'pit' || ground === 'water' || ground === 'hazard') && !reached[y * size.w + x]
    );
  };
  const seen = new Uint8Array(size.w * size.h);
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) {
      if (seen[y * size.w + x] || !isPool(x, y)) continue;
      const pool: Array<[number, number]> = [];
      const queue: Array<[number, number]> = [[x, y]];
      seen[y * size.w + x] = 1;
      let hasShore = false;
      while (queue.length > 0) {
        const [cx, cy] = queue.pop() as [number, number];
        pool.push([cx, cy]);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size.w || ny >= size.h) continue;
          const ni = ny * size.w + nx;
          if (reached[ni]) hasShore = true;
          if (seen[ni] || !isPool(nx, ny)) continue;
          seen[ni] = 1;
          queue.push([nx, ny]);
        }
      }
      if (!hasShore) for (const [px, py] of pool) fillIn(px, py);
    }
  }
}

/** A door is a hole in a wall: both tiles across the opening have to be solid. */
function hasJambs(layers: Layers, size: Size, door: RoomDoor): boolean {
  const jambs: Array<[number, number]> =
    door.axis === 'ns'
      ? [
          [door.x - 1, door.y],
          [door.x + 1, door.y],
        ]
      : [
          [door.x, door.y - 1],
          [door.x, door.y + 1],
        ];
  return jambs.every(
    ([x, y]) => x < 0 || y < 0 || x >= size.w || y >= size.h || layers.blocking[y][x] !== 'void',
  );
}

/**
 * Stage two: breach the wall where the caller decided, then everything that
 * depends on the room being enterable - water, dead space, markers.
 *
 * The interior is spent by this: its layers are written through.
 */
export function finishRoom(
  interior: RoomInterior,
  exits: Exit[],
  params: GenParams,
  meta: PrefabMeta,
): { doc: RoomDoc; resolved: ResolvedParams } {
  const { size, layers } = interior;
  const rng = mulberry32((interior.seed ^ FINISH_SALT) >>> 0);
  const resolved: ResolvedParams = { ...interior.resolved, exits };

  const protectedMask = openExits(layers, size, exits);
  for (const [x0, y0, x1, y1] of interior.protectedRects) {
    markRect(protectedMask, size, x0, y0, x1, y1);
  }

  liquidPass(layers, size, protectedMask, rng, resolved);
  // Nobody wants a doorway full of water: keep the door tiles dry.
  for (const door of interior.doors) layers.ground[door.y][door.x] = 'floor';
  sealPockets(layers, size, exits);
  // Sealing turns pockets into wall, so the drying has to come after it.
  dryUnderBlocking(layers, size);

  const markers = placeMarkers(layers, size, exits, params.markers, rng);

  return {
    doc: {
      size,
      // Cosmetic only, but it must follow the seed or every room decorates alike.
      decorSeed: rng.int(0, 0x3fffffff),
      meta: { ...meta, role: params.roomRole },
      exits,
      // A doorway that the pocket pass walled off is no longer a doorway, and
      // neither is one whose jambs went with it.
      doors: interior.doors.filter(
        (d) => layers.blocking[d.y][d.x] === 'void' && hasJambs(layers, size, d),
      ),
      layers,
      markers,
    },
    resolved,
  };
}

/**
 * Pin each exit to an offset the layout offered, so it opens into a room
 * rather than into rock. Only the offset is taken from the interior: how many
 * exits there are, on which sides and of what kind stays with the caller.
 */
export function snapExitsToOpenings(exits: Exit[], openings: Openings): Exit[] {
  return exits.map((exit) => {
    const offered = openings[exit.side].filter((o) => o !== exit.offset);
    if (openings[exit.side].includes(exit.offset) || offered.length === 0) return exit;
    // The nearest one to what was asked for, so a pinned offset still means
    // something: on a map the two rooms either side have already agreed.
    let best = offered[0];
    for (const candidate of offered) {
      if (Math.abs(candidate - exit.offset) < Math.abs(best - exit.offset)) best = candidate;
    }
    return { ...exit, offset: best };
  });
}

/** Generate, validate, and retry with seed + 1 until the room passes. */
export function generateRoom(params: GenParams, seed: number, meta: PrefabMeta): GenResult {
  let fallback: GenResult | null = null;
  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const trySeed = (seed + attempt) >>> 0;
    const interior = buildInterior(params, trySeed);
    // One room on its own answers to nobody, so it takes the offsets its own
    // layout offers. On a map the offsets are settled between neighbours first.
    const rng = mulberry32((trySeed ^ EXIT_SALT) >>> 0);
    const rolled = pickExits(params, rng);
    // A pinned offset is somebody else's decision - on a map the room next door
    // has agreed to it - so only a rolled one is moved onto an opening.
    const exits = params.exits.auto ? snapExitsToOpenings(rolled, interior.openings) : rolled;
    const { doc, resolved } = finishRoom(interior, exits, params, meta);
    const report = validateRoom(doc);
    const result: GenResult = { doc, resolved, seed: trySeed, attempts: attempt + 1, report };
    if (report.ok) return result;
    if (!fallback) fallback = result;
  }
  // Nothing passed - hand back the first attempt so the user can fix it by hand.
  const last = fallback as GenResult;
  return { ...last, attempts: MAX_GEN_ATTEMPTS };
}
