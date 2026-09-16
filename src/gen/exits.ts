import type { Exit, ExitSide, ExitType, RoomRole } from '../types/prefab';
import { EXIT_SIDES } from '../types/prefab';
import type { Rng } from '../core/rng';
import type { GenParams } from './params';
import { EXIT_WIDTH } from './constants';
import { clampOffset, resolveExits, sideLength } from './outline';

/** How many ways in and out a room of this role wants. */
function exitCountFor(role: RoomRole, rng: Rng): number {
  switch (role) {
    case 'dead_end':
      return 1;
    case 'corridor':
      return 2;
    case 'treasure':
    case 'boss':
      return rng.chance(0.65) ? 1 : 2;
    case 'entrance':
    case 'exit':
      return rng.chance(0.6) ? 1 : 2;
    case 'arena':
      return rng.int(2, 4);
    default:
      return rng.chance(0.55) ? 2 : rng.chance(0.7) ? 3 : 4;
  }
}

function rollExitType(rng: Rng, role: RoomRole): ExitType {
  // A treasure room is the one place a locked door is worth the trouble.
  if (role === 'treasure' && rng.chance(0.35)) return 'locked';
  const roll = rng.next();
  if (roll < 0.5) return 'open';
  if (roll < 0.88) return 'door';
  if (roll < 0.96) return 'locked';
  return 'secret';
}

/** Sides, widths, types and offsets, all from the seed. */
export function rollExits(params: GenParams, rng: Rng): Exit[] {
  const count = exitCountFor(params.roomRole, rng);
  const sides: ExitSide[] =
    params.roomRole === 'corridor'
      ? rng.chance(0.5)
        ? ['n', 's']
        : ['e', 'w']
      : rng.shuffle(EXIT_SIDES).slice(0, count);

  return sides.map((side) => {
    const span = sideLength(params.size, side);
    const width = EXIT_WIDTH;
    const offset = clampOffset(params.size, side, width, rng.int(1, Math.max(1, span - width - 1)));
    return { side, offset, width, type: rollExitType(rng, params.roomRole) };
  });
}

/** The exits for one attempt: rolled from the seed, or exactly as pinned. */
export function pickExits(params: GenParams, rng: Rng): Exit[] {
  return params.exits.auto ? rollExits(params, rng) : resolveExits(params);
}
