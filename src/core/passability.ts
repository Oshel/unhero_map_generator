import type { Layers, TileRole } from '../types/prefab';

/**
 * Which ground roles an actor can stand on. `hazard` is passable (it hurts,
 * it does not block); `pit` and `water` are not, by default.
 */
export interface PassabilityRules {
  water: boolean;
  pit: boolean;
  hazard: boolean;
}

export const DEFAULT_PASSABILITY: PassabilityRules = {
  water: false,
  pit: false,
  hazard: true,
};

export function isGroundPassable(role: TileRole, rules: PassabilityRules): boolean {
  switch (role) {
    case 'floor':
      return true;
    case 'water':
      return rules.water;
    case 'pit':
      return rules.pit;
    case 'hazard':
      return rules.hazard;
    default:
      return false;
  }
}

/** Anything other than `void` on the blocking layer stops movement. */
export function isBlocking(role: TileRole): boolean {
  return role !== 'void';
}

/**
 * What a blocking tile stops besides movement.
 *
 * A `grate` is the odd one out and the reason these two exist: it is a wall you
 * cannot walk through but can see and shoot through, so a fight carries across
 * it. `obstacle_low` is waist high - you see over it, but a shot fired at that
 * height still hits it. Everything else stops all three.
 */
export function blocksSight(role: TileRole): boolean {
  return isBlocking(role) && role !== 'grate' && role !== 'obstacle_low';
}

export function blocksProjectiles(role: TileRole): boolean {
  return isBlocking(role) && role !== 'grate';
}

/** `true` where an actor can stand. Flat array indexed y * w + x. */
export function passabilityMask(
  layers: Layers,
  rules: PassabilityRules = DEFAULT_PASSABILITY,
): { mask: Uint8Array; w: number; h: number } {
  const h = layers.ground.length;
  const w = layers.ground[0]?.length ?? 0;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ground = layers.ground[y][x];
      const blocking = layers.blocking[y][x];
      mask[y * w + x] = !isBlocking(blocking) && isGroundPassable(ground, rules) ? 1 : 0;
    }
  }
  return { mask, w, h };
}
