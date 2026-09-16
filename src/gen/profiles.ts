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
}

export const SUBBIOME_PROFILES: SubbiomeProfile[] = [
  {
    id: 'generic',
    label: 'Generic (no profile)',
    claustrophobia: [20, 75],
    styleWeights: { rooms_in_room: 4, organic: 2, open: 1 },
    obstacleDensity: [10, 70],
  },
  {
    id: 'catacombs',
    label: 'Catacombs - tight, corridor-led',
    claustrophobia: [65, 95],
    styleWeights: { rooms_in_room: 8, organic: 1 },
    obstacleDensity: [20, 55],
  },
  {
    id: 'halls',
    label: 'Halls - open, room to fight',
    claustrophobia: [5, 35],
    styleWeights: { open: 6, rooms_in_room: 2 },
    obstacleDensity: [10, 45],
  },
  {
    id: 'caves',
    label: 'Caves - irregular, uneven',
    claustrophobia: [35, 80],
    styleWeights: { organic: 7, open: 1 },
    obstacleDensity: [25, 70],
  },
];

export const DEFAULT_PROFILE_ID = 'generic';

export function profileById(id: string): SubbiomeProfile {
  return SUBBIOME_PROFILES.find((p) => p.id === id) ?? SUBBIOME_PROFILES[0];
}
