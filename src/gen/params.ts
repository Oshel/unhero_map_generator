import type { Exit, ExitSide, ExitType, ExitWidth, RoomRole, Size } from '../types/prefab';
import type { Rng } from '../core/rng';
import {
  DEFAULT_GRATES,
  DEFAULT_SUBROOM_FLOOR,
  EXIT_WIDTH,
  MAX_GEN_ATTEMPTS,
  MAX_SIZE,
  MAX_SUBROOM_FLOOR,
  MIN_SIZE,
  MIN_SUBROOM_FLOOR,
} from './constants';
import { DEFAULT_PROFILE_ID, profileById, type SubbiomeProfile } from './profiles';

export {
  DEFAULT_GRATES,
  DEFAULT_SUBROOM_FLOOR,
  EXIT_WIDTH,
  MAX_GEN_ATTEMPTS,
  MAX_SIZE,
  MAX_SUBROOM_FLOOR,
  MIN_SIZE,
  MIN_SUBROOM_FLOOR,
};

/**
 * The panel offers a range; anything outside it would break the style. A value
 * that is not a number at all - an older saved prefab, a caller that predates
 * the setting - takes the default rather than poisoning every size with NaN.
 */
export function clampSubRoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SUBROOM_FLOOR;
  return Math.max(MIN_SUBROOM_FLOOR, Math.min(MAX_SUBROOM_FLOOR, Math.round(value)));
}

export type LayoutStyle = 'open' | 'rooms_in_room' | 'organic';

export const LAYOUT_STYLES: readonly LayoutStyle[] = ['open', 'rooms_in_room', 'organic'] as const;

/**
 * Additive styles start from an empty room and drop obstacles into it.
 * Subtractive styles start from solid rock and carve the room out of it - that
 * is the only way to get real corridors and wall mass rather than stray lines.
 */
export const STYLE_MODE: Record<LayoutStyle, 'additive' | 'subtractive'> = {
  open: 'additive',
  rooms_in_room: 'subtractive',
  organic: 'additive',
};

export interface ExitConfig {
  enabled: boolean;
  width: ExitWidth;
  type: ExitType;
  /** `null` centres the exit on its side. */
  offset: number | null;
}

/** A value the seed may roll for you, or that you pin by hand. */
export interface AutoNumber {
  auto: boolean;
  /** 0..100, used when auto is off. */
  value: number;
}

export interface LiquidParams {
  /** When on, the seed decides both presence and density. */
  auto: boolean;
  enabled: boolean;
  /** 0..100 */
  density: number;
}

export interface MarkerCounts {
  spawn: number;
  loot: number;
  prop: number;
}

export interface ExitParams {
  /** When on, the seed picks the sides, widths, types and offsets. */
  auto: boolean;
  sides: Record<ExitSide, ExitConfig>;
}

export interface GenParams {
  size: Size;
  roomRole: RoomRole;
  exits: ExitParams;
  obstacleDensity: AutoNumber;
  /** Subbiome profile id - see gen/profiles.ts. */
  profile: string;
  /** 0 open halls .. 100 corridor warren. */
  claustrophobia: AutoNumber;
  style: { auto: boolean; value: LayoutStyle };
  /**
   * Smallest sub-room a subtractive style may place, counted in floor tiles a
   * side. Bigger means fewer, roomier chambers; smaller means a warren.
   */
  minSubRoom: number;
  /**
   * How much of the wall between one sub-room and the next is bars rather than
   * stone, 0..100. Only `rooms_in_room` has that wall to give: the other styles
   * scatter obstacles into an open room and have nothing to cut a grate into.
   */
  grates: AutoNumber;
  water: LiquidParams;
  pits: LiquidParams;
  markers: MarkerCounts;
}

export const SIZE_PRESETS: ReadonlyArray<{ label: string; size: Size }> = [
  { label: '16 x 16', size: { w: 16, h: 16 } },
  { label: '32 x 24', size: { w: 32, h: 24 } },
  { label: '48 x 32', size: { w: 48, h: 32 } },
  { label: '64 x 48', size: { w: 64, h: 48 } },
];

function exitConfig(enabled: boolean): ExitConfig {
  return { enabled, width: EXIT_WIDTH, type: 'open', offset: null };
}

export function defaultParams(): GenParams {
  return {
    size: { w: 32, h: 24 },
    roomRole: 'normal',
    exits: {
      auto: true,
      sides: {
        n: exitConfig(true),
        e: exitConfig(false),
        s: exitConfig(true),
        w: exitConfig(false),
      },
    },
    obstacleDensity: { auto: true, value: 25 },
    profile: DEFAULT_PROFILE_ID,
    claustrophobia: { auto: true, value: 60 },
    style: { auto: true, value: 'rooms_in_room' },
    minSubRoom: DEFAULT_SUBROOM_FLOOR,
    grates: { auto: true, value: DEFAULT_GRATES },
    water: { auto: true, enabled: false, density: 15 },
    pits: { auto: true, enabled: false, density: 15 },
    markers: { spawn: 4, loot: 2, prop: 6 },
  };
}

/** What the generator actually used, after rolling everything set to auto. */
export interface ResolvedParams {
  exits: Exit[];
  style: LayoutStyle;
  claustrophobia: number;
  obstacleDensity: number;
  grates: number;
  water: { enabled: boolean; density: number };
  pits: { enabled: boolean; density: number };
  /** Which of them came from the seed rather than the panel. */
  rolled: {
    exits: boolean;
    style: boolean;
    claustrophobia: boolean;
    obstacleDensity: boolean;
    grates: boolean;
    water: boolean;
    pits: boolean;
  };
}

/** Ranges the seed rolls within, where the subbiome profile has nothing to say. */
export const AUTO_RANGES = {
  /** Most rooms get a grate or two; a few get none and a few are half bars. */
  grates: [0, 55] as const,
  waterChance: 0.4,
  waterDensity: [10, 45] as const,
  pitChance: 0.3,
  pitDensity: [10, 40] as const,
};

/** Exits are picked by the caller (see gen/exits.ts) and passed in. */
/** Weighted pick over the profile's style table. */
function rollStyle(profile: SubbiomeProfile, rng: Rng): LayoutStyle {
  const entries = LAYOUT_STYLES.map(
    (style) => [style, profile.styleWeights[style] ?? 0] as const,
  ).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return 'rooms_in_room';
  let roll = rng.float(0, total);
  for (const [style, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return style;
  }
  return entries[entries.length - 1][0];
}

export function resolveParams(params: GenParams, rng: Rng, exits: Exit[]): ResolvedParams {
  const profile = profileById(params.profile);

  const style = params.style.auto ? rollStyle(profile, rng) : params.style.value;

  const claustrophobia = params.claustrophobia.auto
    ? rng.int(profile.claustrophobia[0], profile.claustrophobia[1])
    : params.claustrophobia.value;

  const obstacleDensity = params.obstacleDensity.auto
    ? rng.int(profile.obstacleDensity[0], profile.obstacleDensity[1])
    : params.obstacleDensity.value;

  const water = params.water.auto
    ? rng.chance(AUTO_RANGES.waterChance)
      ? { enabled: true, density: rng.int(AUTO_RANGES.waterDensity[0], AUTO_RANGES.waterDensity[1]) }
      : { enabled: false, density: 0 }
    : { enabled: params.water.enabled, density: params.water.density };

  const pits = params.pits.auto
    ? rng.chance(AUTO_RANGES.pitChance)
      ? { enabled: true, density: rng.int(AUTO_RANGES.pitDensity[0], AUTO_RANGES.pitDensity[1]) }
      : { enabled: false, density: 0 }
    : { enabled: params.pits.enabled, density: params.pits.density };

  // Rolled last on purpose: every draw before this one predates grates, and
  // taking a number out of the middle of the stream would move every seed's
  // water and pits along with it.
  const grates = params.grates.auto
    ? rng.int(AUTO_RANGES.grates[0], AUTO_RANGES.grates[1])
    : params.grates.value;

  return {
    exits,
    style,
    claustrophobia,
    obstacleDensity,
    grates,
    water,
    pits,
    rolled: {
      exits: params.exits.auto,
      style: params.style.auto,
      claustrophobia: params.claustrophobia.auto,
      obstacleDensity: params.obstacleDensity.auto,
      grates: params.grates.auto,
      water: params.water.auto,
      pits: params.pits.auto,
    },
  };
}
