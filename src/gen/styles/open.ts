import { densityFactor, obstacleRole, placeBlob, tightness, type StyleFn } from './context';

/**
 * Empty floor, a wall outline, scattered obstacles. It stays an open hall at any
 * setting - claustrophobia only decides how much rubble stands in it.
 */
export const openStyle: StyleFn = (ctx) => {
  const { w, h } = ctx.size;
  const c = tightness(ctx);
  const area = (w - 2) * (h - 2);
  const count = Math.round(
    area * densityFactor(ctx.resolved.obstacleDensity) * 0.06 * (0.6 + c * 1.6),
  );
  for (let i = 0; i < count; i++) {
    const x = ctx.rng.int(1, w - 2);
    const y = ctx.rng.int(1, h - 2);
    const size = ctx.rng.chance(0.2 + c * 0.4) ? 2 : 1;
    placeBlob(ctx, x, y, size, size, obstacleRole(ctx));
  }
};
