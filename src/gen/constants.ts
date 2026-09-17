/**
 * Plain constants, imported by geometry, generation and validation alike.
 * They live apart so no two modules have to import each other to reach them -
 * a cycle here silently turns a constant into `undefined` at module init.
 */

/** The opening between two rooms of a map. No door hangs in it. */
export const EXIT_WIDTH = 2;

/** The gate in and out of the whole map, on the first and last room only. */
export const GATE_WIDTH = 2;

/** A doorway into a sub-room inside a room: one tile, with a door in it. */
export const DOOR_WIDTH = 1;

/**
 * A grate is a run of bars standing in a wall: you see and shoot through it,
 * you do not walk through it. One tile of it is a loophole rather than a
 * window, and a run longer than this is a wall the room has stopped having.
 */
export const MIN_GRATE_RUN = 2;
export const MAX_GRATE_RUN = 5;

/** Where the grate slider sits before anyone touches it. */
export const DEFAULT_GRATES = 30;

/**
 * Floor of the smallest sub-room a subtractive style will place, as the player
 * sees it - the wall ring around it is the generator's business and is added on
 * top. One tile of floor is a cupboard, not a room; past a dozen the style has
 * nothing small enough left to pack the leftovers with.
 */
export const MIN_SUBROOM_FLOOR = 2;
export const MAX_SUBROOM_FLOOR = 12;
export const DEFAULT_SUBROOM_FLOOR = 3;

/** Narrowest corridor the generator will carve. */
export const MIN_CORRIDOR_WIDTH = 2;

/** Widest corridor, used at the open end of the claustrophobia range. */
export const MAX_CORRIDOR_WIDTH = 6;

export const MAX_GEN_ATTEMPTS = 50;

export const MIN_SIZE = 12;
export const MAX_SIZE = 64;
