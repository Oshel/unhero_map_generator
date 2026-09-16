import { densityFactor, place, tightness, type StyleFn } from './context';

/** Cellular automata - irregular, cave-like blobs. */
export const organicStyle: StyleFn = (ctx) => {
  const { w, h } = ctx.size;
  // Claustrophobia sets how much rock there is; density only tints it.
  const fill = 0.3 + tightness(ctx) * 0.2 + densityFactor(ctx.resolved.obstacleDensity) * 0.08;
  let cells = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) cells[y * w + x] = ctx.rng.chance(fill) ? 1 : 0;
  }

  const neighbours = (src: Uint8Array, x: number, y: number): number => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        // Outside counts as solid so caves hug the shell.
        if (nx < 1 || ny < 1 || nx > w - 2 || ny > h - 2) n++;
        else n += src[ny * w + nx];
      }
    }
    return n;
  };

  for (let pass = 0; pass < 4; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const n = neighbours(cells, x, y);
        next[y * w + x] = n >= 5 ? 1 : n <= 2 ? 0 : cells[y * w + x];
      }
    }
    cells = next;
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!cells[y * w + x]) continue;
      // Rock, not furniture: a cave wall has to read as wall and autotile as one.
      place(ctx, x, y, 'wall');
    }
  }
};
