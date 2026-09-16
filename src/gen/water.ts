import type { Layers, Size, TileRole } from '../types/prefab';
import type { Rng } from '../core/rng';
import type { ResolvedParams } from './params';

function freeGround(
  layers: Layers,
  size: Size,
  protectedMask: Uint8Array,
  x: number,
  y: number,
): boolean {
  if (x < 1 || y < 1 || x > size.w - 2 || y > size.h - 2) return false;
  if (protectedMask[y * size.w + x]) return false;
  if (layers.blocking[y][x] !== 'void') return false;
  return layers.ground[y][x] === 'floor';
}

/** One random-walk blob of the given role. */
function blob(
  layers: Layers,
  size: Size,
  protectedMask: Uint8Array,
  rng: Rng,
  role: TileRole,
  budget: number,
): number {
  let x = rng.int(2, size.w - 3);
  let y = rng.int(2, size.h - 3);
  let painted = 0;
  for (let step = 0; step < budget * 4 && painted < budget; step++) {
    if (freeGround(layers, size, protectedMask, x, y)) {
      layers.ground[y][x] = role;
      painted++;
    }
    switch (rng.int(0, 3)) {
      case 0:
        x++;
        break;
      case 1:
        x--;
        break;
      case 2:
        y++;
        break;
      default:
        y--;
        break;
    }
    x = Math.max(1, Math.min(size.w - 2, x));
    y = Math.max(1, Math.min(size.h - 2, y));
  }
  return painted;
}

/**
 * Ground under anything solid goes back to plain floor. Water and pits are
 * painted before the pocket pass walls off what no exit can reach, so without
 * this a sealed-off pond ends up buried inside the wall mass - a pit drawn in
 * the middle of solid rock, which is what the player actually sees.
 */
export function dryUnderBlocking(layers: Layers, size: Size): void {
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) {
      if (layers.blocking[y][x] === 'void') continue;
      const ground = layers.ground[y][x];
      if (ground === 'pit' || ground === 'water' || ground === 'hazard') {
        layers.ground[y][x] = 'floor';
      }
    }
  }
}

/** Water and pits, painted on the ground layer after the style pass. */
export function liquidPass(
  layers: Layers,
  size: Size,
  protectedMask: Uint8Array,
  rng: Rng,
  params: ResolvedParams,
): void {
  const interior = (size.w - 2) * (size.h - 2);
  const passes: Array<[TileRole, number]> = [];
  if (params.water.enabled) passes.push(['water', params.water.density]);
  if (params.pits.enabled) passes.push(['pit', params.pits.density]);

  for (const [role, density] of passes) {
    const target = Math.round((interior * Math.max(0, Math.min(100, density))) / 100 / 5);
    if (target <= 0) continue;
    const blobs = Math.max(1, Math.round(target / 18));
    const perBlob = Math.max(4, Math.round(target / blobs));
    for (let i = 0; i < blobs; i++) blob(layers, size, protectedMask, rng, role, perBlob);
  }
}
