import type { Exit, Layers, Markers, Size, SpawnTier } from '../types/prefab';
import type { Rng } from '../core/rng';
import { floodFill } from '../core/floodfill';
import { DEFAULT_PASSABILITY, passabilityMask } from '../core/passability';
import { emptyMarkers, DEFAULT_PROP_KIND } from '../types/editor';
import { apronRect, exitAnchor } from './outline';
import type { MarkerCounts } from './params';

const PROP_KINDS = ['barrel', 'crate', 'urn', 'brazier', 'rubble', 'bones'] as const;

interface Candidate {
  x: number;
  y: number;
}

function far(taken: Candidate[], c: Candidate, minDist: number): boolean {
  return taken.every((t) => Math.abs(t.x - c.x) + Math.abs(t.y - c.y) >= minDist);
}

/**
 * Spread markers over walkable tiles that are reachable from the exits and
 * clear of the exit aprons.
 */
export function placeMarkers(
  layers: Layers,
  size: Size,
  exits: Exit[],
  counts: MarkerCounts,
  rng: Rng,
): Markers {
  const markers = emptyMarkers();
  const passable = passabilityMask(layers, DEFAULT_PASSABILITY);
  const seeds = exits.map((e) => exitAnchor(size, e));
  const reachable = seeds.length > 0 ? floodFill(passable, seeds) : passable.mask;

  const blocked = new Uint8Array(size.w * size.h);
  for (const exit of exits) {
    const [x0, y0, x1, y1] = apronRect(size, exit);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) blocked[y * size.w + x] = 1;
    }
  }

  const candidates: Candidate[] = [];
  for (let y = 1; y < size.h - 1; y++) {
    for (let x = 1; x < size.w - 1; x++) {
      const i = y * size.w + x;
      if (passable.mask[i] && reachable[i] && !blocked[i]) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return markers;

  const pool = rng.shuffle(candidates);
  const taken: Candidate[] = [];
  let cursor = 0;

  const take = (minDist: number): Candidate | null => {
    for (let tries = 0; tries < pool.length; tries++) {
      const c = pool[(cursor + tries) % pool.length];
      if (taken.some((t) => t.x === c.x && t.y === c.y)) continue;
      if (!far(taken, c, minDist)) continue;
      cursor = (cursor + tries + 1) % pool.length;
      taken.push(c);
      return c;
    }
    return null;
  };

  const tierFor = (index: number): SpawnTier => {
    if (index === 0 && rng.chance(0.3)) return 'elite';
    return rng.chance(0.35) ? 'trash' : 'normal';
  };

  for (let i = 0; i < counts.spawn; i++) {
    const c = take(4);
    if (!c) break;
    markers.spawn.push({ x: c.x, y: c.y, tier: tierFor(i) });
  }
  for (let i = 0; i < counts.loot; i++) {
    const c = take(5);
    if (!c) break;
    markers.loot.push({ x: c.x, y: c.y });
  }
  for (let i = 0; i < counts.prop; i++) {
    const c = take(2);
    if (!c) break;
    markers.prop.push({ x: c.x, y: c.y, kind: rng.chance(0.5) ? DEFAULT_PROP_KIND : rng.pick(PROP_KINDS) });
  }

  return markers;
}
