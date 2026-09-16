import type { RoomDoor, Size } from '../../types/prefab';
import { clampSubRoom, type GenParams } from '../params';
import { carveRect, exitAnchor } from '../outline';
import type { StyleContext, StyleFn } from './context';

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Dir = 'n' | 's' | 'w' | 'e';
const DIRS: Dir[] = ['n', 's', 'w', 'e'];

/** Corridors are two tiles wide. All of them, main and side alike. */
const CORRIDOR_WIDTH = 2;

/** The main corridor wanders: this many turns before it arrives. */
const MIN_BENDS = 3;
const MAX_BENDS = 4;

/** Side corridors branching off the main one. Two at most. */
const MAX_SIDE_CORRIDORS = 2;

const DEAD_ENDS_BEFORE_STOP = 500;
const PRESSURE_SPAN = 150;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function tightness(ctx: StyleContext): number {
  return Math.max(0, Math.min(100, ctx.resolved.claustrophobia)) / 100;
}

/** How far a sub-room may be stretched or pulled back to sit flush on a wall. */
const SNAP_TO_SHELL = 3;

/**
 * The panel asks for floor, the generator works in rects: a room of three by
 * three floor tiles is a five by five rect once its wall ring is counted.
 */
function minRoomSide(params: GenParams): number {
  return clampSubRoom(params.minSubRoom) + 2;
}

/** Wall ring plus the smallest floor worth calling a room. */
function bigEnough(
  r: { x0: number; y0: number; x1: number; y1: number },
  minSide: number,
): boolean {
  return r.x1 - r.x0 + 1 >= minSide && r.y1 - r.y0 + 1 >= minSide;
}

/** Sub-rooms get smaller and more numerous as the subbiome tightens. */
function roomSizeRange(c: number, minSide: number): [number, number] {
  const low = Math.max(minSide, Math.round(lerp(minSide + 2, minSide, c)));
  return [low, Math.max(low, Math.round(lerp(14, 9, c)))];
}

/**
 * A sub-room may sit flush against the room's own shell: its wall ring is then
 * that shell, which is what lets a map hang a door straight into the chamber
 * instead of digging a passage to it. Only the interior is ever carved, so the
 * shell itself stays whole.
 */
function insideInterior(size: Size, r: Rect): boolean {
  return r.x0 >= 0 && r.y0 >= 0 && r.x1 <= size.w - 1 && r.y1 <= size.h - 1;
}

/**
 * A wandering main corridor, up to two side corridors off it, and then rooms
 * packed into whatever is left.
 *
 * Every corridor is two tiles wide, the main one included - a grand hall down
 * the middle reads as a different kind of place entirely. The main run takes
 * three or four turns on its way rather than the shortest path, so the room has
 * a route through it instead of a diagonal.
 */
export const roomsInRoomStyle: StyleFn = (ctx) => {
  const { size, layers } = ctx;
  const c = tightness(ctx);

  // 1. Solid rock.
  for (let y = 1; y < size.h - 1; y++) {
    for (let x = 1; x < size.w - 1; x++) {
      layers.ground[y][x] = 'floor';
      layers.blocking[y][x] = 'wall';
    }
  }

  /** Rock a doorway may be punched through: never the shell. */
  const isRock = (x: number, y: number): boolean =>
    x >= 1 && y >= 1 && x < size.w - 1 && y < size.h - 1 && layers.blocking[y][x] === 'wall';

  /** Rock a room may be cut out of, the shell included - it is a wall too. */
  const isSolid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < size.w && y < size.h && layers.blocking[y][x] === 'wall';

  const clear = (r: Rect, margin: number, attached?: Dir): boolean => {
    if (!insideInterior(size, r)) return false;
    const top = r.y0 - (attached === 's' ? 0 : margin);
    const bottom = r.y1 + (attached === 'n' ? 0 : margin);
    const left = r.x0 - (attached === 'e' ? 0 : margin);
    const right = r.x1 + (attached === 'w' ? 0 : margin);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        if (!isSolid(x, y)) return false;
      }
    }
    return true;
  };

  /** Floor tiles a room can hang off, collected as we carve. */
  const anchors: Array<[number, number]> = [];
  /**
   * Tiles that have to stay solid: the two jambs either side of a doorway. A
   * room placed later may legally take rock that belongs to an older room's
   * wall ring, and if that rock is a jamb the older door ends up with a gap
   * beside it instead of a wall.
   */
  const reserved = new Set<number>();
  const corridors: Rect[] = [];
  const carveCorridorRect = (r: Rect): void => {
    const x0 = Math.max(1, Math.min(r.x0, r.x1));
    const y0 = Math.max(1, Math.min(r.y0, r.y1));
    const x1 = Math.min(size.w - 2, Math.max(r.x0, r.x1));
    const y1 = Math.min(size.h - 2, Math.max(r.y0, r.y1));
    if (x1 < x0 || y1 < y0) return;
    carveRect(layers, size, x0, y0, x1, y1);
    corridors.push({ x0, y0, x1, y1 });
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) anchors.push([x, y]);
    }
  };

  /** A two-wide run between two points: one leg on each axis. */
  const carryTo = (from: [number, number], to: [number, number], horizontalFirst: boolean): void => {
    const [fx, fy] = from;
    const [tx, ty] = to;
    const w = CORRIDOR_WIDTH - 1;
    if (horizontalFirst) {
      carveCorridorRect({ x0: fx, y0: fy, x1: tx + w, y1: fy + w });
      carveCorridorRect({ x0: tx, y0: fy, x1: tx + w, y1: ty + w });
    } else {
      carveCorridorRect({ x0: fx, y0: fy, x1: fx + w, y1: ty + w });
      carveCorridorRect({ x0: fx, y0: ty, x1: tx + w, y1: ty + w });
    }
  };

  // 2. The main corridor: from the first exit to the last, the long way round.
  const exitAnchors = ctx.exits.map((exit) => exitAnchor(size, exit));
  const start: [number, number] = exitAnchors[0] ?? [2, Math.floor(size.h / 2)];
  const finish: [number, number] =
    exitAnchors.length > 1
      ? exitAnchors[exitAnchors.length - 1]
      : [size.w - 3, Math.floor(size.h / 2)];

  const bends = ctx.rng.int(MIN_BENDS, MAX_BENDS);
  const waypoints: Array<[number, number]> = [start];
  for (let i = 1; i < bends; i++) {
    // Waypoints drift off the straight line, and that drift is the turns.
    const t = i / bends;
    const driftX = ctx.rng.int(-Math.floor(size.w / 4), Math.floor(size.w / 4));
    const driftY = ctx.rng.int(-Math.floor(size.h / 4), Math.floor(size.h / 4));
    waypoints.push([
      Math.max(3, Math.min(size.w - 5, Math.round(lerp(start[0], finish[0], t)) + driftX)),
      Math.max(3, Math.min(size.h - 5, Math.round(lerp(start[1], finish[1], t)) + driftY)),
    ]);
  }
  waypoints.push(finish);
  for (let i = 1; i < waypoints.length; i++) {
    carryTo(waypoints[i - 1], waypoints[i], ctx.rng.chance(0.5));
  }

  // Any exit in between joins the main run directly.
  for (let i = 1; i < exitAnchors.length - 1; i++) {
    carryTo(exitAnchors[i], waypoints[ctx.rng.int(1, waypoints.length - 2)], ctx.rng.chance(0.5));
  }

  // 3. At most two side corridors off the main one.
  const sideCount = ctx.rng.int(1, MAX_SIDE_CORRIDORS);
  for (let placed = 0, tries = 0; placed < sideCount && tries < 80; tries++) {
    const parent = corridors[ctx.rng.int(0, corridors.length - 1)];
    const dir = DIRS[ctx.rng.int(0, 3)];
    const length = ctx.rng.int(Math.round(size.w / 5), Math.round(size.w / 2));
    const along =
      dir === 'n' || dir === 's'
        ? ctx.rng.int(parent.x0, parent.x1)
        : ctx.rng.int(parent.y0, parent.y1);
    const w = CORRIDOR_WIDTH - 1;
    const rect: Rect =
      dir === 'n'
        ? { x0: along, y0: parent.y0 - length, x1: along + w, y1: parent.y0 - 1 }
        : dir === 's'
          ? { x0: along, y0: parent.y1 + 1, x1: along + w, y1: parent.y1 + length }
          : dir === 'w'
            ? { x0: parent.x0 - length, y0: along, x1: parent.x0 - 1, y1: along + w }
            : { x0: parent.x1 + 1, y0: along, x1: parent.x1 + length, y1: along + w };
    if (!clear(rect, 1, dir)) continue;
    carveCorridorRect(rect);
    placed++;
  }

  // 4. Rooms, until nothing else fits. A room hangs off any floor tile - a
  //    corridor, or a room already placed - through a single doorway.
  const [minSide, maxSide] = roomSizeRange(c, minRoomSide(ctx.params));
  let deadEnds = 0;
  const pressure = (): number => Math.min(1, deadEnds / PRESSURE_SPAN);
  const roomSide = (): number =>
    ctx.rng.int(minSide, Math.max(minSide, Math.round(lerp(maxSide, minSide, pressure()))));

  while (deadEnds < DEAD_ENDS_BEFORE_STOP && anchors.length > 0) {
    // Most floor tiles sit deep inside something already built. Sample a few and
    // take one with rock in front of it, or nearly every attempt is wasted on a
    // wall we already know about.
    let ax = 0;
    let ay = 0;
    let dir: Dir = 'n';
    let found = false;
    for (let probe = 0; probe < 6 && !found; probe++) {
      const [px, py] = anchors[ctx.rng.int(0, anchors.length - 1)];
      const candidate = DIRS[ctx.rng.int(0, 3)];
      const nx = candidate === 'w' ? px - 1 : candidate === 'e' ? px + 1 : px;
      const ny = candidate === 'n' ? py - 1 : candidate === 's' ? py + 1 : py;
      if (!isRock(nx, ny)) continue;
      ax = px;
      ay = py;
      dir = candidate;
      found = true;
    }
    if (!found) {
      deadEnds++;
      continue;
    }
    // The room hangs straight off the tile in front of the anchor: that tile is
    // the room's own wall, and the doorway is punched through it. Leaving rock
    // between the two instead turns every doorway into a two tile passage one
    // tile wide - a stub of corridor nobody asked for in front of every door.
    const w = roomSide();
    const h = roomSide();

    let rect: Rect;
    let door: RoomDoor;
    switch (dir) {
      case 'n':
        rect = { x0: ax - Math.floor(w / 2), y0: ay - h, x1: 0, y1: ay - 1 };
        rect.x1 = rect.x0 + w - 1;
        door = { x: ax, y: rect.y1, axis: 'ns' };
        break;
      case 's':
        rect = { x0: ax - Math.floor(w / 2), y0: ay + 1, x1: 0, y1: ay + h };
        rect.x1 = rect.x0 + w - 1;
        door = { x: ax, y: rect.y0, axis: 'ns' };
        break;
      case 'w':
        rect = { x0: ax - w, y0: ay - Math.floor(h / 2), x1: ax - 1, y1: 0 };
        rect.y1 = rect.y0 + h - 1;
        door = { x: rect.x1, y: ay, axis: 'ew' };
        break;
      default:
        rect = { x0: ax + 1, y0: ay - Math.floor(h / 2), x1: ax + w, y1: 0 };
        rect.y1 = rect.y0 + h - 1;
        door = { x: rect.x0, y: ay, axis: 'ew' };
        break;
    }

    // A room that stops a tile or two short of the room's own shell is snapped
    // flush to it, and one that would overshoot is pulled back to it instead of
    // being thrown away. A sub-room whose wall is the shell is a sub-room a map
    // can hang a door on - that is the whole point of the openings.
    const snapped: Rect = { ...rect };
    if (dir !== 's' && snapped.y0 <= SNAP_TO_SHELL) snapped.y0 = 0;
    if (dir !== 'n' && snapped.y1 >= size.h - 1 - SNAP_TO_SHELL) snapped.y1 = size.h - 1;
    if (dir !== 'e' && snapped.x0 <= SNAP_TO_SHELL) snapped.x0 = 0;
    if (dir !== 'w' && snapped.x1 >= size.w - 1 - SNAP_TO_SHELL) snapped.x1 = size.w - 1;
    // Pulling an overshooting room back must not squeeze it out of existence:
    // a rect narrower than its own wall ring has no interior to carve, and the
    // carve would run backwards straight through the shell.
    if (bigEnough(snapped, minSide) && clear(snapped, 0)) rect = snapped;
    if (!bigEnough(rect, minSide)) {
      deadEnds++;
      continue;
    }

    // The doorway has to land in the room's own wall, and not in a corner of
    // it: a corner has the room's wall on one side and whatever the neighbours
    // left on the other, which is how you get a door with a gap beside it.
    const inWall =
      door.axis === 'ns'
        ? door.x > rect.x0 && door.x < rect.x1 && (door.y === rect.y0 || door.y === rect.y1)
        : door.y > rect.y0 && door.y < rect.y1 && (door.x === rect.x0 || door.x === rect.x1);
    if (!inWall) {
      deadEnds++;
      continue;
    }
    if (!clear(rect, 0)) {
      deadEnds++;
      continue;
    }
    // Both tiles across the doorway have to be solid and stay solid. They are
    // this room's own wall ring, but a sub-room placed earlier may already have
    // punched its own door through one of them, and two doors side by side are
    // not a doorway, they are a gap.
    const jambs: Array<[number, number]> =
      door.axis === 'ns'
        ? [
            [door.x - 1, door.y],
            [door.x + 1, door.y],
          ]
        : [
            [door.x, door.y - 1],
            [door.x, door.y + 1],
          ];
    if (!jambs.every(([jx, jy]) => isRock(jx, jy))) {
      deadEnds++;
      continue;
    }
    // Nor may the room being carved out take a jamb that is already spoken for.
    let takesAJamb = false;
    for (let y = rect.y0 + 1; y <= rect.y1 - 1 && !takesAJamb; y++) {
      for (let x = rect.x0 + 1; x <= rect.x1 - 1 && !takesAJamb; x++) {
        if (reserved.has(y * size.w + x)) takesAJamb = true;
      }
    }
    if (takesAJamb) {
      deadEnds++;
      continue;
    }

    carveRect(layers, size, rect.x0 + 1, rect.y0 + 1, rect.x1 - 1, rect.y1 - 1);
    carveRect(layers, size, door.x, door.y, door.x, door.y);
    ctx.doors.push(door);
    for (const [jx, jy] of jambs) reserved.add(jy * size.w + jx);
    for (let y = rect.y0 + 1; y <= rect.y1 - 1; y++) {
      for (let x = rect.x0 + 1; x <= rect.x1 - 1; x++) anchors.push([x, y]);
    }
    deadEnds = 0;
  }

  // 5. Clutter against the walls, never in a doorway.
  const clutter = ctx.resolved.obstacleDensity / 100;
  const doorAt = new Set(ctx.doors.map((d) => `${d.x},${d.y}`));
  for (let y = 2; y < size.h - 2; y++) {
    for (let x = 2; x < size.w - 2; x++) {
      if (layers.blocking[y][x] !== 'void') continue;
      if (doorAt.has(`${x},${y}`)) continue;
      if (ctx.protectedMask[y * size.w + x]) continue;
      const againstWall =
        layers.blocking[y - 1][x] === 'wall' ||
        layers.blocking[y + 1][x] === 'wall' ||
        layers.blocking[y][x - 1] === 'wall' ||
        layers.blocking[y][x + 1] === 'wall';
      if (!againstWall) continue;
      if (!ctx.rng.chance(clutter * 0.08)) continue;
      layers.blocking[y][x] = ctx.rng.chance(0.55) ? 'obstacle_low' : 'obstacle_high';
    }
  }
};
