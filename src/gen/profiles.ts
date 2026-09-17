import type { LayoutStyle } from './params';

/**
 * Per-subbiome generation tuning. Art lives in the tileset pack; this is how the
 * space itself should feel, which is a different decision and belongs to the
 * game's content, not to the art.
 *
 * Kept as a typed table so it is trivially movable into JSON under
 * `content/subbiomes/` once the game owns the generator.
 */
export interface SubbiomeProfile {
  id: string;
  label: string;
  /**
   * 0 = open halls you can fight across, 100 = a warren of corridors.
   * Drives corridor width, chamber size, how much of the room stays solid and
   * which layout styles come up.
   */
  claustrophobia: [number, number];
  /** Relative odds of each layout style when the style is left on auto. */
  styleWeights: Partial<Record<LayoutStyle, number>>;
  obstacleDensity: [number, number];
  /**
   * Whether a whole map may be built from this profile.
   *
   * A map is a place - one subbiome, laid out across the grid so that no two
   * rooms you can walk between feel alike. "No profile" is not a place, it is
   * the escape hatch for working on a single room with the ranges opened up,
   * and a map made of it comes out as a dungeon of nowhere in particular. So
   * it is offered for one room and withheld from maps.
   */
  onMaps: boolean;
}

export const SUBBIOME_PROFILES: SubbiomeProfile[] = [
  {
    id: 'generic',
    label: 'Generic (no profile)',
    claustrophobia: [20, 75],
    styleWeights: { rooms_in_room: 4, organic: 2, open: 1 },
    obstacleDensity: [10, 70],
    onMaps: false,
  },
  {
    id: 'catacombs',
    label: 'Catacombs - tight, corridor-led',
    claustrophobia: [65, 95],
    styleWeights: { rooms_in_room: 8, organic: 1 },
    obstacleDensity: [20, 55],
    onMaps: true,
  },
];

export const DEFAULT_PROFILE_ID = 'generic';

/** The subbiomes a whole map can be built from. */
export const MAP_PROFILES: SubbiomeProfile[] = SUBBIOME_PROFILES.filter((p) => p.onMaps);

export const DEFAULT_MAP_PROFILE_ID = MAP_PROFILES[0].id;

export function profileById(id: string): SubbiomeProfile {
  return SUBBIOME_PROFILES.find((p) => p.id === id) ?? SUBBIOME_PROFILES[0];
}
