import { densityFactor, placeBlob, tightness, type StyleFn } from './context';

/** Regular grid of pillars. Tighter settings mean fatter columns, closer together. */
export const pillarsStyle: StyleFn = (ctx) => {
  const { w, h } = ctx.size;
  const d = densityFactor(ctx.resolved.obstacleDensity);
  const c = tightness(ctx);
  // Spacing never drops below the minimum path width plus the pillar itself.
  const pillar = d > 0.66 || c > 0.6 ? (c > 0.8 ? 3 : 2) : 1;
  const gap = Math.max(4, Math.round(9 - d * 2 - c * 3));
  const step = gap + pillar;
  const startX = 2 + Math.floor(((w - 4) % step) / 2);
  const startY = 2 + Math.floor(((h - 4) % step) / 2);
  for (let y = startY; y <= h - 2 - pillar; y += step) {
    for (let x = startX; x <= w - 2 - pillar; x += step) {
      placeBlob(ctx, x, y, pillar, pillar, pillar > 1 ? 'wall' : 'obstacle_high');
    }
  }
};
