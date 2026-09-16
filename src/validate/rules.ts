import type { Exit, Size } from '../types/prefab';
import type { RoomDoc } from '../types/editor';
import { EXIT_SIDES } from '../types/prefab';
import { floodFill, type Mask } from '../core/floodfill';
import { passabilityMask, type PassabilityRules } from '../core/passability';
import { EXIT_WIDTH, GATE_WIDTH } from '../gen/constants';
import { exitAnchor, exitTiles, sideLength } from '../gen/outline';

export type Tile = [number, number];

export interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  message: string;
  /** Tiles to highlight on the canvas. */
  tiles: Tile[];
}

export interface RuleContext {
  doc: RoomDoc;
  size: Size;
  passable: Mask;
  rules: PassabilityRules;
}

export function makeRuleContext(doc: RoomDoc, rules: PassabilityRules): RuleContext {
  return { doc, size: doc.size, passable: passabilityMask(doc.layers, rules), rules };
}

function anchors(ctx: RuleContext): Tile[] {
  return ctx.doc.exits.map((e) => exitAnchor(ctx.size, e));
}

/** Tiles reachable from any exit. Falls back to the whole room when exitless. */
export function reachableFromExits(ctx: RuleContext): Uint8Array {
  const seeds = anchors(ctx);
  if (seeds.length === 0) return ctx.passable.mask;
  return floodFill(ctx.passable, seeds);
}

export function checkExitsValid(ctx: RuleContext): CheckResult {
  const { size } = ctx;
  const problems: string[] = [];
  const tiles: Tile[] = [];
  const perSide = new Map<string, Exit[]>();

  for (const exit of ctx.doc.exits) {
    const span = sideLength(size, exit.side);
    if (exit.width !== EXIT_WIDTH && exit.width !== GATE_WIDTH) {
      problems.push(
        `exit ${exit.side}@${exit.offset}: width must be ${EXIT_WIDTH} (door) or ${GATE_WIDTH} (gate)`,
      );
    }
    if (exit.offset < 1 || exit.offset + exit.width > span - 1) {
      problems.push(`exit ${exit.side}@${exit.offset}: sticks out of its side`);
      tiles.push(...exitTiles(size, exit));
    }
    const list = perSide.get(exit.side) ?? [];
    list.push(exit);
    perSide.set(exit.side, list);
  }

  for (const side of EXIT_SIDES) {
    const list = (perSide.get(side) ?? []).slice().sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      if (list[i].offset < prev.offset + prev.width) {
        problems.push(`exits on side ${side} overlap`);
        tiles.push(...exitTiles(size, list[i]));
      }
    }
  }

  return {
    id: 'exits_valid',
    label: 'Exits in bounds, no overlap',
    ok: problems.length === 0,
    message: problems.length === 0 ? `${ctx.doc.exits.length} exit(s) placed` : problems.join('; '),
    tiles,
  };
}

export function checkOutlineSealed(ctx: RuleContext): CheckResult {
  const { size, doc } = ctx;
  const isExitTile = new Set<string>();
  for (const exit of doc.exits) {
    for (const [x, y] of exitTiles(size, exit)) isExitTile.add(`${x},${y}`);
  }
  const leaks: Tile[] = [];
  for (let x = 0; x < size.w; x++) {
    for (const y of [0, size.h - 1]) {
      if (isExitTile.has(`${x},${y}`)) continue;
      if (doc.layers.blocking[y][x] === 'void') leaks.push([x, y]);
    }
  }
  for (let y = 0; y < size.h; y++) {
    for (const x of [0, size.w - 1]) {
      if (isExitTile.has(`${x},${y}`)) continue;
      if (doc.layers.blocking[y][x] === 'void') leaks.push([x, y]);
    }
  }
  const blockedExits: Tile[] = [];
  for (const exit of doc.exits) {
    for (const [x, y] of exitTiles(size, exit)) {
      if (!ctx.passable.mask[y * size.w + x]) blockedExits.push([x, y]);
    }
  }
  const tiles = [...leaks, ...blockedExits];
  const ok = tiles.length === 0;
  return {
    id: 'outline_sealed',
    label: 'Outline sealed except at exits',
    ok,
    message: ok
      ? 'Border is solid, exits are open'
      : `${leaks.length} hole(s) in the border, ${blockedExits.length} blocked exit tile(s)`,
    tiles,
  };
}

export function checkExitsConnected(ctx: RuleContext): CheckResult {
  const list = ctx.doc.exits;
  if (list.length < 2) {
    return {
      id: 'exits_connected',
      label: 'All exits connected',
      ok: true,
      message: list.length === 0 ? 'No exits to connect' : 'Single exit',
      tiles: [],
    };
  }
  const seeds = anchors(ctx);
  const seen = floodFill(ctx.passable, [seeds[0]]);
  const unreachable: Tile[] = [];
  for (let i = 1; i < seeds.length; i++) {
    const [x, y] = seeds[i];
    if (!seen[y * ctx.size.w + x]) unreachable.push([x, y]);
  }
  const ok = unreachable.length === 0;
  return {
    id: 'exits_connected',
    label: 'All exits connected',
    ok,
    message: ok ? `${list.length} exits share one region` : `${unreachable.length} exit(s) cut off`,
    tiles: unreachable,
  };
}

export function checkNoPockets(ctx: RuleContext): CheckResult {
  const reachable = reachableFromExits(ctx);
  const stranded: Tile[] = [];
  for (let y = 0; y < ctx.size.h; y++) {
    for (let x = 0; x < ctx.size.w; x++) {
      const i = y * ctx.size.w + x;
      if (ctx.passable.mask[i] && !reachable[i]) stranded.push([x, y]);
    }
  }
  const ok = stranded.length === 0;
  return {
    id: 'no_pockets',
    label: 'No walkable tile cut off',
    ok,
    message: ok
      ? 'The room is one walkable region'
      : `${stranded.length} walkable tile(s) unreachable from the exits`,
    tiles: stranded,
  };
}

export function checkMarkers(ctx: RuleContext): CheckResult {
  const reachable = reachableFromExits(ctx);
  const bad: Tile[] = [];
  const notes: string[] = [];
  let total = 0;
  const { markers } = ctx.doc;
  const groups: Array<[string, Array<{ x: number; y: number }>]> = [
    ['spawn', markers.spawn],
    ['loot', markers.loot],
    ['prop', markers.prop],
    ['objective', markers.objective],
  ];
  for (const [name, list] of groups) {
    let offending = 0;
    for (const m of list) {
      total++;
      const i = m.y * ctx.size.w + m.x;
      const inside = m.x >= 0 && m.y >= 0 && m.x < ctx.size.w && m.y < ctx.size.h;
      if (!inside || !ctx.passable.mask[i] || !reachable[i]) {
        offending++;
        bad.push([m.x, m.y]);
      }
    }
    if (offending > 0) notes.push(`${offending} ${name}`);
  }
  const ok = bad.length === 0;
  return {
    id: 'markers_reachable',
    label: 'Markers walkable and reachable',
    ok,
    message: ok
      ? `${total} marker(s) fine`
      : `unreachable or blocked: ${notes.join(', ')} (light markers are not checked)`,
    tiles: bad,
  };
}
