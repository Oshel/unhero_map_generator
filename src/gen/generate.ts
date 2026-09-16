import type { Exit, Layers, RoomDoor, Size } from '../types/prefab';
import type { PrefabMeta, RoomDoc } from '../types/editor';
import { makeLayers } from '../core/grid';
import { floodFill } from '../core/floodfill';
import { largestComponent } from '../core/floodfill';
import { passabilityMask } from '../core/passability';
import { mulberry32 } from '../core/rng';
import { validateRoom, type ValidationReport } from '../validate/validate';
import { placeMarkers } from './markers';
import {
  apronRect,
  buildShell,
  carveExits,
  carveRect,
  clampToInterior,
  corridorRects,
  fitToInterior,
  exitAnchor,
  markRect,
} from './outline';
import { MAX_CORRIDOR_WIDTH, MAX_GEN_ATTEMPTS, MIN_CORRIDOR_WIDTH } from './constants';
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
 * Tiles that must stay walkable: the apron in front of every exit plus a
 * corridor from each exit to the middle of the room. Styles paint around them.
 */
function buildProtected(
  size: Size,
  exits: Exit[],
  rng: ReturnType<typeof mulberry32>,
  resolved: ResolvedParams,
): { mask: Uint8Array; rects: Array<[number, number, number, number]> } {
  // A subtractive style digs its own corridors and joins every exit itself.
  // Forcing spokes to the middle on top of that would undo the whole point.
  const digsItsOwn = STYLE_MODE[resolved.style] === 'subtractive';
  const claustro = Math.max(0, Math.min(100, resolved.claustrophobia)) / 100;
  const mask = new Uint8Array(size.w * size.h);
  const rects: Array<[number, number, number, number]> = [];
  const center: [number, number] = [Math.floor(size.w / 2), Math.floor(size.h / 2)];

  for (const exit of exits) {
    rects.push(clampToInterior(size, apronRect(size, exit)));
    if (digsItsOwn) continue;
    const [ax, ay] = exitAnchor(size, exit);
    // Tight rooms get the bare minimum, open ones get a proper thoroughfare.
    const width = Math.max(
      MIN_CORRIDOR_WIDTH,
      Math.round(MIN_CORRIDOR_WIDTH + (1 - claustro) * (MAX_CORRIDOR_WIDTH - MIN_CORRIDOR_WIDTH)),
    );
    const horizontalFirst = exit.side === 'e' || exit.side === 'w' ? false : true;
    const legs = corridorRects(ax, ay, center[0], center[1], width, horizontalFirst);
    for (const leg of legs) rects.push(fitToInterior(size, leg));
  }

  if (exits.length === 0 && !digsItsOwn) {
    // Exitless rooms still get an open middle so there is something to look at.
    const half = MAX_CORRIDOR_WIDTH - 1;
    rects.push(
      clampToInterior(size, [center[0] - half, center[1] - half, center[0] + half, center[1] + half]),
    );
  } else if (!digsItsOwn && exits.length > 1 && claustro < 0.5 && rng.chance(0.6)) {
    // Open layouts get a hall in the middle; tight ones must not.
    const half = MAX_CORRIDOR_WIDTH - 1;
    rects.push(
      clampToInterior(size, [center[0] - half, center[1] - half, center[0] + half, center[1] + half]),
    );
  }

  for (const [x0, y0, x1, y1] of rects) markRect(mask, size, x0, y0, x1, y1);
  return { mask, rects };
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
    ([x, y]) =>
      x < 0 || y < 0 || x >= size.w || y >= size.h || layers.blocking[y][x] !== 'void',
  );
}

function buildOnce(
  params: GenParams,
  seed: number,
  meta: PrefabMeta,
): { doc: RoomDoc; resolved: ResolvedParams } {
  const rng = mulberry32(seed);
  // Rolled first, so a retry with seed + 1 also retries exits and densities.
  const exits = pickExits(params, rng);
  const resolved = resolveParams(params, rng, exits);
  const size: Size = { w: params.size.w, h: params.size.h };
  const layers = makeLayers(size.w, size.h);

  buildShell(layers, size);
  const protectedArea = buildProtected(size, exits, rng, resolved);
  // Styles that build sub-rooms report their doorways here.
  const doors: RoomDoor[] = [];
  STYLE_REGISTRY[resolved.style]({
    size,
    layers,
    exits,
    protectedMask: protectedArea.mask,
    rng,
    params,
    resolved,
    doors,
  });

  // Guaranteed routes are carved last so nothing can close them.
  for (const [x0, y0, x1, y1] of protectedArea.rects) carveRect(layers, size, x0, y0, x1, y1);
  carveExits(layers, size, exits);

  liquidPass(layers, size, protectedArea.mask, rng, resolved);
  // Nobody wants a doorway full of water: keep the door tiles dry.
  for (const door of doors) layers.ground[door.y][door.x] = 'floor';
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
      // neither is one whose jambs went with it - the exit aprons are carved
      // after the style has run and can take the wall a door was hung in.
      doors: doors.filter((d) => layers.blocking[d.y][d.x] === 'void' && hasJambs(layers, size, d)),
      layers,
      markers,
    },
    resolved,
  };
}

/** Generate, validate, and retry with seed + 1 until the room passes. */
export function generateRoom(params: GenParams, seed: number, meta: PrefabMeta): GenResult {
  let fallback: GenResult | null = null;
  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const trySeed = (seed + attempt) >>> 0;
    const { doc, resolved } = buildOnce(params, trySeed, meta);
    const report = validateRoom(doc);
    const result: GenResult = { doc, resolved, seed: trySeed, attempts: attempt + 1, report };
    if (report.ok) return result;
    if (!fallback) fallback = result;
  }
  // Nothing passed - hand back the first attempt so the user can fix it by hand.
  const last = fallback as GenResult;
  return { ...last, attempts: MAX_GEN_ATTEMPTS };
}
