import type { Layers, TileGrid, TileRole } from '../types/prefab';

export function makeGrid(w: number, h: number, fill: TileRole): TileGrid {
  const grid: TileGrid = new Array(h);
  for (let y = 0; y < h; y++) grid[y] = new Array<TileRole>(w).fill(fill);
  return grid;
}

export function cloneGrid(grid: TileGrid): TileGrid {
  return grid.map((row) => row.slice());
}

export function cloneLayers(layers: Layers): Layers {
  return {
    ground: cloneGrid(layers.ground),
    blocking: cloneGrid(layers.blocking),
    deco: cloneGrid(layers.deco),
    overlay: cloneGrid(layers.overlay),
  };
}

export function makeLayers(w: number, h: number): Layers {
  return {
    ground: makeGrid(w, h, 'void'),
    blocking: makeGrid(w, h, 'void'),
    deco: makeGrid(w, h, 'void'),
    overlay: makeGrid(w, h, 'void'),
  };
}

export function gridSize(grid: TileGrid): { w: number; h: number } {
  return { w: grid[0]?.length ?? 0, h: grid.length };
}

export function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function get(grid: TileGrid, x: number, y: number): TileRole {
  const row = grid[y];
  if (!row) return 'void';
  return row[x] ?? 'void';
}

export function set(grid: TileGrid, x: number, y: number, role: TileRole): void {
  const row = grid[y];
  if (row && x >= 0 && x < row.length) row[x] = role;
}

export function forEachTile(
  w: number,
  h: number,
  fn: (x: number, y: number) => void,
): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(x, y);
}

export const NEIGHBORS_4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
