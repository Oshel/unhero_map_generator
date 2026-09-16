import type { Rng } from '../core/rng';
import type { LayoutStyle } from '../gen/params';
import { LAYOUT_STYLES } from '../gen/params';
import { profileById } from '../gen/profiles';

/**
 * What each room on the grid is made of, decided for the whole map at once.
 *
 * Rolling every room on its own gives runs of the same thing - three rooms of
 * the same shape in a row, and the dungeon reads as one room repeated. So the
 * flavours are laid out as a graph colouring instead: neighbours differ in
 * layout style and in how tight they are, while each option still gets about
 * the same number of rooms. Walking the dungeon then means a different kind of
 * space behind every door.
 */
export interface RoomFlavour {
  profile: string;
  style: LayoutStyle;
  /** Claustrophobia to pin, 0..100. */
  tightness: number;
}

interface Cellish {
  col: number;
  row: number;
}

/**
 * Tightness bands as a position inside the subbiome's own range, not as a flat
 * 0..100: a hall clamped to a catacomb's numbers stops being a hall.
 */
const BANDS = [0, 0.5, 1] as const;

/** Two rooms closer than this in claustrophobia read as the same room twice. */
const TIGHTNESS_CONTRAST = 25;

/**
 * Matching the room next door costs; matching on the diagonal costs less, since
 * you never walk straight through a corner.
 */
const SIDE_COST = 4;
const DIAGONAL_COST = 1;

function sideNeighbours(index: number, cols: number, rows: number): number[] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const out: number[] = [];
  if (col > 0) out.push(index - 1);
  if (col + 1 < cols) out.push(index + 1);
  if (row > 0) out.push(index - cols);
  if (row + 1 < rows) out.push(index + cols);
  return out;
}

function diagonalNeighbours(index: number, cols: number, rows: number): number[] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const out: number[] = [];
  for (const [dc, dr] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const c = col + dc;
    const r = row + dr;
    if (c >= 0 && r >= 0 && c < cols && r < rows) out.push(r * cols + c);
  }
  return out;
}

/** When two rooms count as the same. Numbers are alike, not just equal. */
type Alike<T> = (a: T, b: T) => boolean;

const EQUAL = <T,>(a: T, b: T): boolean => a === b;

/** What one room costs the map, given what its neighbours already are. */
function cellCost<T>(
  values: T[],
  index: number,
  value: T,
  cols: number,
  rows: number,
  alike: Alike<T> = EQUAL,
): number {
  let cost = 0;
  for (const n of sideNeighbours(index, cols, rows)) {
    if (values[n] !== undefined && alike(values[n], value)) cost += SIDE_COST;
  }
  for (const n of diagonalNeighbours(index, cols, rows)) {
    if (values[n] !== undefined && alike(values[n], value)) cost += DIAGONAL_COST;
  }
  return cost;
}

/**
 * Pick per room from a list that differs room to room - a style has to be one
 * the subbiome actually uses. Greedy in a random order, then repair passes,
 * with a nudge towards whatever is currently under-used so the map does not
 * lean on one option.
 */
function constrainedColouring<T>(
  total: number,
  cols: number,
  rows: number,
  candidates: (index: number) => T[],
  rng: Rng,
  alike: Alike<T> = EQUAL,
): T[] {
  const values = new Array<T>(total);
  const counts = new Map<T, number>();
  const fair = (): number => total / Math.max(1, counts.size);
  const score = (i: number, value: T): number =>
    cellCost(values, i, value, cols, rows, alike) +
    ((counts.get(value) ?? 0) > fair() ? 1 : 0) +
    rng.float(0, 0.5);
  const retally = (from: T, to: T): void => {
    counts.set(from, (counts.get(from) ?? 0) - 1);
    counts.set(to, (counts.get(to) ?? 0) + 1);
  };

  // Row by row, so each room only ever has to dodge the one to its left and the
  // one above. Filling in a random order strands whole patches in a pattern no
  // single room can improve on, and the repair below cannot climb out of that.
  const order = Array.from({ length: total }, (_, i) => i);
  for (const i of order) {
    const options = candidates(i);
    for (const option of options) if (!counts.has(option)) counts.set(option, 0);
    let best = options[0];
    let bestScore = Infinity;
    for (const option of options) {
      const s = score(i, option);
      if (s < bestScore) {
        bestScore = s;
        best = option;
      }
    }
    values[i] = best;
    counts.set(best, (counts.get(best) ?? 0) + 1);
  }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const i of rng.shuffle(order)) {
      if (cellCost(values, i, values[i], cols, rows, alike) === 0) continue;
      let best = values[i];
      let bestScore = score(i, values[i]);
      for (const option of candidates(i)) {
        if (option === values[i]) continue;
        const s = score(i, option);
        if (s < bestScore) {
          bestScore = s;
          best = option;
        }
      }
      if (best !== values[i]) {
        retally(values[i], best);
        values[i] = best;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return values;
}

/**
 * A flavour per cell of the room grid, in cell-index order. Every room of a map
 * belongs to the same subbiome; what alternates is the style and the tightness,
 * so the dungeon never runs the same kind of room twice in a row.
 */
export function assignFlavours(
  cells: readonly Cellish[],
  cols: number,
  rng: Rng,
  profile: string,
): RoomFlavour[] {
  const total = cells.length;
  const rows = Math.max(1, Math.ceil(total / cols));
  const profiles = new Array<string>(total).fill(profile);

  // A style the room's own subbiome would never roll would undo the subbiome,
  // so the candidates are that profile's own table.
  const stylesFor = (index: number): LayoutStyle[] => {
    const weights = profileById(profiles[index]).styleWeights;
    const usable = LAYOUT_STYLES.filter((s) => (weights[s] ?? 0) > 0);
    return usable.length > 0 ? usable : [...LAYOUT_STYLES];
  };
  const styles = constrainedColouring<LayoutStyle>(total, cols, rows, stylesFor, rng);

  // Tightness is a number, so neighbours are judged on the gap between them
  // rather than on being unequal: 40 next to 45 is the same room twice over.
  const tightnessFor = (index: number): number[] => {
    const [low, high] = profileById(profiles[index]).claustrophobia;
    return BANDS.map((band) => Math.round(low + (high - low) * band));
  };
  const tightness = constrainedColouring<number>(
    total,
    cols,
    rows,
    tightnessFor,
    rng,
    (a, b) => Math.abs(a - b) < TIGHTNESS_CONTRAST,
  );

  const flavours: RoomFlavour[] = [];
  for (let i = 0; i < total; i++) {
    flavours.push({ profile: profiles[i], style: styles[i], tightness: tightness[i] });
  }
  return flavours;
}

interface Flavoured {
  col: number;
  row: number;
  profile: string;
  style: LayoutStyle;
}

/** Neighbouring rooms that came out the same kind of space anyway. */
export function flavourClashes<T extends Flavoured>(rooms: readonly T[]): Array<[T, T]> {
  const byCell = new Map<string, T>();
  for (const room of rooms) byCell.set(`${room.col},${room.row}`, room);
  const out: Array<[T, T]> = [];
  for (const room of rooms) {
    for (const [dc, dr] of [
      [1, 0],
      [0, 1],
    ]) {
      const other = byCell.get(`${room.col + dc},${room.row + dr}`);
      if (!other) continue;
      if (other.profile === room.profile && other.style === room.style) out.push([room, other]);
    }
  }
  return out;
}
