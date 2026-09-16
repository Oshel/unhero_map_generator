import type { Exit, Layers, RoomDoor, Size, TileRole } from '../../types/prefab';
import type { Rng } from '../../core/rng';
import type { GenParams, ResolvedParams } from '../params';

export interface StyleContext {
  size: Size;
  layers: Layers;
  exits: Exit[];
  /** 1 = tile must stay walkable (aprons, corridor spines). */
  protectedMask: Uint8Array;
  rng: Rng;
  params: GenParams;
  /** Densities after the seed rolled whatever was set to auto. */
  resolved: ResolvedParams;
  /** Styles that build sub-rooms push their doorways here. */
  doors: RoomDoor[];
}

export type StyleFn = (ctx: StyleContext) => void;

/** Interior tile that is not reserved for a guaranteed path. */
export function canPlace(ctx: StyleContext, x: number, y: number): boolean {
  const { w, h } = ctx.size;
  if (x < 1 || y < 1 || x > w - 2 || y > h - 2) return false;
  return ctx.protectedMask[y * w + x] === 0;
}

export function place(ctx: StyleContext, x: number, y: number, role: TileRole): void {
  if (!canPlace(ctx, x, y)) return;
  ctx.layers.blocking[y][x] = role;
}

export function placeBlob(
  ctx: StyleContext,
  x: number,
  y: number,
  w: number,
  h: number,
  role: TileRole,
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) place(ctx, x + dx, y + dy, role);
  }
}

/** Claustrophobia as 0..1. Every style has to answer to it somehow. */
export function tightness(ctx: StyleContext): number {
  return Math.max(0, Math.min(100, ctx.resolved.claustrophobia)) / 100;
}

/** Obstacle density 0..100 mapped into a usable probability range. */
export function densityFactor(density: number): number {
  return Math.max(0, Math.min(100, density)) / 100;
}

export function obstacleRole(ctx: StyleContext, lowChance = 0.35): TileRole {
  return ctx.rng.chance(lowChance) ? 'obstacle_low' : 'obstacle_high';
}
