import type { RoomDoc } from '../types/editor';
import { DEFAULT_PASSABILITY, type PassabilityRules } from '../core/passability';
import {
  checkExitsConnected,
  checkExitsValid,
  checkMarkers,
  checkNoPockets,
  checkOutlineSealed,
  makeRuleContext,
  type CheckResult,
  type Tile,
} from './rules';

export interface ValidationReport {
  ok: boolean;
  checks: CheckResult[];
  /** Union of every failing check's tiles, for the canvas overlay. */
  problemTiles: Tile[];
}

export function validateRoom(
  doc: RoomDoc,
  rules: PassabilityRules = DEFAULT_PASSABILITY,
): ValidationReport {
  const ctx = makeRuleContext(doc, rules);
  const checks = [
    checkExitsConnected(ctx),
    checkNoPockets(ctx),
    checkMarkers(ctx),
    checkExitsValid(ctx),
    checkOutlineSealed(ctx),
  ];
  const problemTiles: Tile[] = [];
  for (const check of checks) {
    if (!check.ok) problemTiles.push(...check.tiles);
  }
  return { ok: checks.every((c) => c.ok), checks, problemTiles };
}
