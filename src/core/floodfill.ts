import { NEIGHBORS_4 } from './grid';

export interface Mask {
  mask: Uint8Array;
  w: number;
  h: number;
}

/**
 * 4-connected flood fill from the given seeds over passable cells.
 * Returns a reachability mask of the same shape.
 */
export function floodFill(m: Mask, seeds: ReadonlyArray<readonly [number, number]>): Uint8Array {
  const { mask, w, h } = m;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const [sx, sy] of seeds) {
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    const i = sy * w + sx;
    if (!mask[i] || seen[i]) continue;
    seen[i] = 1;
    stack.push(i);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of NEIGHBORS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || !mask[ni]) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

/** Connected components of passable cells. `-1` for impassable cells. */
export function components(m: Mask): { labels: Int32Array; count: number; sizes: number[] } {
  const { mask, w, h } = m;
  const labels = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const label = count++;
    let size = 0;
    labels[start] = label;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop() as number;
      size++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of NEIGHBORS_4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!mask[ni] || labels[ni] !== -1) continue;
        labels[ni] = label;
        stack.push(ni);
      }
    }
    sizes.push(size);
  }
  return { labels, count, sizes };
}

/** Index of the largest connected component, or -1 when nothing is passable. */
export function largestComponent(m: Mask): { labels: Int32Array; label: number } {
  const { labels, sizes } = components(m);
  let best = -1;
  let bestSize = 0;
  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] > bestSize) {
      bestSize = sizes[i];
      best = i;
    }
  }
  return { labels, label: best };
}
