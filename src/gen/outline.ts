import type { Exit, ExitSide, Layers, Size } from '../types/prefab';
import { EXIT_SIDES } from '../types/prefab';
import { MIN_CORRIDOR_WIDTH } from './constants';
import type { GenParams } from './params';

/** Length of a side in tiles. */
export function sideLength(size: Size, side: ExitSide): number {
  return side === 'n' || side === 's' ? size.w : size.h;
}

/** Exit offsets are clamped so an exit never eats a corner tile. */
export function clampOffset(size: Size, side: ExitSide, width: number, offset: number): number {
  const span = sideLength(size, side);
  const max = Math.max(1, span - width - 1);
  return Math.min(max, Math.max(1, Math.round(offset)));
}

/** The exits exactly as the panel has them pinned. */
export function resolveExits(params: GenParams): Exit[] {
  const exits: Exit[] = [];
  for (const side of EXIT_SIDES) {
    const cfg = params.exits.sides[side];
    if (!cfg.enabled) continue;
    const span = sideLength(params.size, side);
    const raw = cfg.offset ?? Math.floor((span - cfg.width) / 2);
    exits.push({
      side,
      offset: clampOffset(params.size, side, cfg.width, raw),
      width: cfg.width,
      type: cfg.type,
    });
  }
  return exits;
}

/** Border tiles occupied by an exit. */
export function exitTiles(size: Size, exit: Exit): Array<[number, number]> {
  const tiles: Array<[number, number]> = [];
  for (let i = 0; i < exit.width; i++) {
    switch (exit.side) {
      case 'n':
        tiles.push([exit.offset + i, 0]);
        break;
      case 's':
        tiles.push([exit.offset + i, size.h - 1]);
        break;
      case 'w':
        tiles.push([0, exit.offset + i]);
        break;
      case 'e':
        tiles.push([size.w - 1, exit.offset + i]);
        break;
    }
  }
  return tiles;
}

/** Tile just inside the room, in the middle of the exit. Used as a path seed. */
export function exitAnchor(size: Size, exit: Exit): [number, number] {
  const mid = exit.offset + Math.floor(exit.width / 2);
  switch (exit.side) {
    case 'n':
      return [mid, 1];
    case 's':
      return [mid, size.h - 2];
    case 'w':
      return [1, mid];
    case 'e':
      return [size.w - 2, mid];
  }
}

/** Walls around the whole room, floor everywhere underneath. */
export function buildShell(layers: Layers, size: Size): void {
  const { w, h } = size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      layers.ground[y][x] = 'floor';
      const onBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      layers.blocking[y][x] = onBorder ? 'wall' : 'void';
    }
  }
}

/** Put the wall ring back, closing any exit that used to be there. */
export function resealBorder(layers: Layers, size: Size): void {
  const { w, h } = size;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'wall';
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'wall';
    }
  }
}

/** Punch the exits through the shell. */
export function carveExits(layers: Layers, size: Size, exits: Exit[]): void {
  for (const exit of exits) {
    for (const [x, y] of exitTiles(size, exit)) {
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'void';
    }
  }
}

export function carveRect(
  layers: Layers,
  size: Size,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const lo = { x: Math.max(0, Math.min(x0, x1)), y: Math.max(0, Math.min(y0, y1)) };
  const hi = { x: Math.min(size.w - 1, Math.max(x0, x1)), y: Math.min(size.h - 1, Math.max(y0, y1)) };
  for (let y = lo.y; y <= hi.y; y++) {
    for (let x = lo.x; x <= hi.x; x++) {
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'void';
    }
  }
}

export function markRect(
  mask: Uint8Array,
  size: Size,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const lo = { x: Math.max(0, Math.min(x0, x1)), y: Math.max(0, Math.min(y0, y1)) };
  const hi = { x: Math.min(size.w - 1, Math.max(x0, x1)), y: Math.min(size.h - 1, Math.max(y0, y1)) };
  for (let y = lo.y; y <= hi.y; y++) {
    for (let x = lo.x; x <= hi.x; x++) mask[y * size.w + x] = 1;
  }
}

/** Rect covering a corridor of `width` tiles running from a to b, axis-aligned. */
function segmentRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
): [number, number, number, number] {
  const half = Math.floor(width / 2);
  const other = width - half - 1;
  if (ay === by) {
    return [Math.min(ax, bx), ay - half, Math.max(ax, bx), ay + other];
  }
  return [ax - half, Math.min(ay, by), ax + other, Math.max(ay, by)];
}

/**
 * Two-segment (L shaped) corridor of the given width. Returns the rects so the
 * caller can both carve them and keep them free of obstacles later.
 */
export function corridorRects(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  horizontalFirst: boolean,
): Array<[number, number, number, number]> {
  const corner = horizontalFirst ? { x: bx, y: ay } : { x: ax, y: by };
  return [
    segmentRect(ax, ay, corner.x, corner.y, width),
    segmentRect(corner.x, corner.y, bx, by, width),
  ];
}

/**
 * Keep a corridor inside the shell without making it thinner: slide it in, and
 * only trim when it genuinely cannot fit. Trimming instead of sliding is how a
 * 4-tile corridor next to a wall silently becomes a 3-tile bottleneck.
 */
export function fitToInterior(
  size: Size,
  rect: [number, number, number, number],
): [number, number, number, number] {
  let [x0, y0, x1, y1] = rect;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (x0 < 1) {
    x0 = 1;
    x1 = x0 + w - 1;
  }
  if (x1 > size.w - 2) {
    x1 = size.w - 2;
    x0 = x1 - w + 1;
  }
  if (y0 < 1) {
    y0 = 1;
    y1 = y0 + h - 1;
  }
  if (y1 > size.h - 2) {
    y1 = size.h - 2;
    y0 = y1 - h + 1;
  }
  return clampToInterior(size, [x0, y0, x1, y1]);
}

/** Keep carved corridors inside the shell so the outline stays sealed. */
export function clampToInterior(
  size: Size,
  rect: [number, number, number, number],
): [number, number, number, number] {
  const [x0, y0, x1, y1] = rect;
  return [
    Math.max(1, x0),
    Math.max(1, y0),
    Math.min(size.w - 2, x1),
    Math.min(size.h - 2, y1),
  ];
}

/** Depth of the guaranteed free apron in front of every exit. */
export const APRON_DEPTH = MIN_CORRIDOR_WIDTH + 1;

export function apronRect(size: Size, exit: Exit): [number, number, number, number] {
  const d = APRON_DEPTH;
  switch (exit.side) {
    case 'n':
      return [exit.offset, 1, exit.offset + exit.width - 1, Math.min(size.h - 2, d)];
    case 's':
      return [exit.offset, Math.max(1, size.h - 1 - d), exit.offset + exit.width - 1, size.h - 2];
    case 'w':
      return [1, exit.offset, Math.min(size.w - 2, d), exit.offset + exit.width - 1];
    case 'e':
      return [Math.max(1, size.w - 1 - d), exit.offset, size.w - 2, exit.offset + exit.width - 1];
  }
}
