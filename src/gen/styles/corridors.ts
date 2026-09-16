import type { Size } from '../../types/prefab';
import type { Rng } from '../../core/rng';
import { MAX_CORRIDOR_WIDTH, MIN_CORRIDOR_WIDTH } from '../constants';
import { carveRect, corridorRects, exitAnchor, fitToInterior } from '../outline';
import type { StyleContext, StyleFn } from './context';

interface Node {
  x: number;
  y: number;
  /** Exits must stay in the graph; chambers may be dropped if they collide. */
  fixed: boolean;
}

interface Chamber {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Corridor width in tiles: wide halls when open, cramped passages when tight. */
export function corridorWidth(claustrophobia: number, rng: Rng): number {
  const c = Math.max(0, Math.min(100, claustrophobia)) / 100;
  const base = Math.round(lerp(MAX_CORRIDOR_WIDTH, MIN_CORRIDOR_WIDTH, c));
  return Math.max(MIN_CORRIDOR_WIDTH, base + (rng.chance(0.25) ? 1 : 0));
}

/**
 * How much of the room ends up walkable. This is the number claustrophobia
 * actually controls - chamber count and corridor width are just the means.
 */
export function openBudget(claustrophobia: number): number {
  return lerp(0.62, 0.26, Math.max(0, Math.min(100, claustrophobia)) / 100);
}

function chamberSizeRange(claustrophobia: number): [number, number] {
  const c = claustrophobia / 100;
  return [Math.round(lerp(10, 5, c)), Math.round(lerp(17, 8, c))];
}

function overlaps(a: Chamber, b: Chamber, gap: number): boolean {
  return (
    a.x0 - gap <= b.x1 && a.x1 + gap >= b.x0 && a.y0 - gap <= b.y1 && a.y1 + gap >= b.y0
  );
}

function placeChambers(size: Size, ctx: StyleContext, chamberBudget: number): Chamber[] {
  const [minSide, maxSide] = chamberSizeRange(ctx.resolved.claustrophobia);
  const chambers: Chamber[] = [];
  let carved = 0;
  const target = 12;
  for (let i = 0; i < target * 12 && chambers.length < target && carved < chamberBudget; i++) {
    const w = ctx.rng.int(minSide, maxSide);
    const h = ctx.rng.int(minSide, maxSide);
    if (w + 4 > size.w || h + 4 > size.h) continue;
    const x0 = ctx.rng.int(2, size.w - 3 - w);
    const y0 = ctx.rng.int(2, size.h - 3 - h);
    const candidate: Chamber = { x0, y0, x1: x0 + w, y1: y0 + h };
    if (chambers.some((other) => overlaps(candidate, other, 2))) continue;
    chambers.push(candidate);
    carved += (w + 1) * (h + 1);
  }
  return chambers;
}

function distance(a: Node, b: Node): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Minimum spanning tree over the nodes, so everything is reachable by build. */
function spanningEdges(nodes: Node[]): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  if (nodes.length < 2) return edges;
  const inTree = new Set<number>([0]);
  while (inTree.size < nodes.length) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < nodes.length; j++) {
        if (inTree.has(j)) continue;
        const d = distance(nodes[i], nodes[j]);
        if (d < bestDist) {
          bestDist = d;
          best = [i, j];
        }
      }
    }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  return edges;
}

/**
 * Start from solid rock and cut the room out of it: chambers joined by
 * corridors, everything else left as wall. This is what produces real corridors
 * and wall mass - an additive style can only ever sprinkle obstacles.
 */
export const corridorsStyle: StyleFn = (ctx) => {
  const { size, layers } = ctx;
  const c = Math.max(0, Math.min(100, ctx.resolved.claustrophobia)) / 100;

  // 1. Fill the interior with rock.
  for (let y = 1; y < size.h - 1; y++) {
    for (let x = 1; x < size.w - 1; x++) {
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'wall';
    }
  }

  const interior = (size.w - 2) * (size.h - 2);
  const budget = openBudget(ctx.resolved.claustrophobia) * interior;
  const openArea = (): number => {
    let n = 0;
    for (let y = 1; y < size.h - 1; y++) {
      for (let x = 1; x < size.w - 1; x++) if (layers.blocking[y][x] === 'void') n++;
    }
    return n;
  };

  // 2. Chambers take a bit over half the budget; corridors need the rest.
  const chambers = placeChambers(size, ctx, budget * 0.55);
  for (const room of chambers) carveRect(layers, size, room.x0, room.y0, room.x1, room.y1);

  // 3. Nodes: chamber centres plus the tile just inside each exit.
  const nodes: Node[] = chambers.map((room) => ({
    x: Math.floor((room.x0 + room.x1) / 2),
    y: Math.floor((room.y0 + room.y1) / 2),
    fixed: false,
  }));
  for (const exit of ctx.exits) {
    const [ax, ay] = exitAnchor(size, exit);
    nodes.push({ x: ax, y: ay, fixed: true });
  }
  if (nodes.length === 0) {
    nodes.push({ x: Math.floor(size.w / 2), y: Math.floor(size.h / 2), fixed: true });
  }

  const width = corridorWidth(ctx.resolved.claustrophobia, ctx.rng);
  const carveCorridor = (a: Node, b: Node): void => {
    const legs = corridorRects(a.x, a.y, b.x, b.y, width, ctx.rng.chance(0.5));
    for (const leg of legs) {
      const [x0, y0, x1, y1] = fitToInterior(size, leg);
      carveRect(layers, size, x0, y0, x1, y1);
    }
  };

  // 4. Connect everything, then add a loop or two so the room is not a tree.
  const edges = spanningEdges(nodes);
  for (const [a, b] of edges) carveCorridor(nodes[a], nodes[b]);

  // Loops and stubs are extras: they only happen while there is budget left, so
  // a tight room stays tight instead of being nibbled open by flavour.
  const loops = nodes.length >= 4 ? (ctx.rng.chance(0.75) ? 2 : 1) : 0;
  for (let i = 0; i < loops; i++) {
    if (openArea() >= budget * 0.95) break;
    const a = ctx.rng.int(0, nodes.length - 1);
    const b = ctx.rng.int(0, nodes.length - 1);
    if (a !== b) carveCorridor(nodes[a], nodes[b]);
  }

  // 5. Dead-end stubs: side passages that go nowhere. Pure flavour, and the
  //    thing that makes a warren feel explored rather than solved.
  const stubs = Math.round(lerp(1, 5, c));
  for (let i = 0; i < stubs; i++) {
    if (openArea() >= budget) break;
    const from = nodes[ctx.rng.int(0, nodes.length - 1)];
    const length = ctx.rng.int(width + 1, width * 3);
    const horizontal = ctx.rng.chance(0.5);
    const sign = ctx.rng.chance(0.5) ? 1 : -1;
    const to: Node = {
      x: from.x + (horizontal ? length * sign : 0),
      y: from.y + (horizontal ? 0 : length * sign),
      fixed: false,
    };
    carveCorridor(from, to);
  }

  // 6. Clutter, so chambers are not empty boxes. It hugs the chamber walls and
  //    only goes into chambers wide enough to keep a 4-tile lane through the
  //    middle - a chamber can be the only route between two exits.
  const clutter = ctx.resolved.obstacleDensity / 100;
  for (const room of chambers) {
    const w = room.x1 - room.x0 + 1;
    const h = room.y1 - room.y0 + 1;
    // Leave a clear lane through the middle: a chamber can be the only route.
    if (Math.min(w, h) < MIN_CORRIDOR_WIDTH + 4) continue;
    const count = Math.round(w * h * clutter * 0.05);
    for (let i = 0; i < count; i++) {
      const x = ctx.rng.int(room.x0, room.x1);
      const y = ctx.rng.int(room.y0, room.y1);
      const onRing =
        x === room.x0 || x === room.x1 || y === room.y0 || y === room.y1;
      if (!onRing) continue;
      if (ctx.protectedMask[y * size.w + x]) continue;
      layers.blocking[y][x] = ctx.rng.chance(0.55) ? 'obstacle_low' : 'obstacle_high';
    }
  }
};
