/** Deterministic PRNG. Never use Math.random anywhere in this tool. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** True with the given probability (0..1). */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[];
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
  return rng;
}

/** A seed for the "new random seed" button. Uses time, not Math.random. */
export function timeSeed(): number {
  return (Date.now() ^ (performance.now() * 1000)) >>> 0;
}

/**
 * Hash of a tile position, for picking variants. A plain `x * a + y * b` is
 * linear, so with two variants it lays a checkerboard and with four it lays
 * diagonal stripes - exactly the pattern variants exist to break. This mixes
 * the bits properly and stays deterministic.
 */
export function hashTile(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Float in [0, 1) derived from a tile position. */
export function hashUnit(x: number, y: number, salt = 0): number {
  return hashTile(x, y, salt) / 4294967296;
}
