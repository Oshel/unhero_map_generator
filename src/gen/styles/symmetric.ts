import type { TileRole } from '../../types/prefab';
import { densityFactor, place, tightness, type StyleFn } from './context';

/** Build the left half, mirror it onto the right. */
export const symmetricStyle: StyleFn = (ctx) => {
  const { w, h } = ctx.size;
  const half = Math.ceil(w / 2);
  const pattern: (TileRole | null)[][] = Array.from({ length: h }, () =>
    new Array<TileRole | null>(half).fill(null),
  );

  const d = densityFactor(ctx.resolved.obstacleDensity);
  const c = tightness(ctx);
  const blobs = Math.max(2, Math.round(((half - 2) * (h - 2) * (d * 0.6 + c * 0.9)) / 45));
  for (let i = 0; i < blobs; i++) {
    const bw = ctx.rng.int(1, 3 + Math.round(c * 2));
    const bh = ctx.rng.int(1, 3 + Math.round(c * 2));
    const x = ctx.rng.int(1, Math.max(1, half - 1 - bw));
    const y = ctx.rng.int(1, Math.max(1, h - 2 - bh));
    // One tile is an object; a block of them is a wall, and has to look like one.
    const role: TileRole =
      bw * bh >= 4 ? 'wall' : ctx.rng.chance(0.35) ? 'obstacle_low' : 'obstacle_high';
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (py < h && px < half) pattern[py][px] = role;
      }
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < half; x++) {
      const role = pattern[y][x];
      if (!role) continue;
      place(ctx, x, y, role);
      place(ctx, w - 1 - x, y, role);
    }
  }
};
