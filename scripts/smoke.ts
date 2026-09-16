/**
 * Headless sanity run: generate rooms across every style and size, report how
 * often validation passes, and check that export -> import round-trips.
 *
 *   npx esbuild scripts/smoke.ts --bundle --platform=node --format=cjs --outfile=tmp/smoke.cjs
 *   node tmp/smoke.cjs
 */
import { defaultMeta } from '../src/types/editor';
import { generateRoom } from '../src/gen/generate';
import { DEFAULT_SUBROOM_FLOOR, LAYOUT_STYLES, SIZE_PRESETS, defaultParams } from '../src/gen/params';
import { ROOM_ROLES } from '../src/types/prefab';
import type { Layers } from '../src/types/prefab';
import { DEFAULT_PROFILE_ID, SUBBIOME_PROFILES } from '../src/gen/profiles';
import { generateMap, mapFixtures, shortestRoute } from '../src/map/generateMap';
import { passabilityMask } from '../src/core/passability';
import { MAP_SIZE_PRESETS } from '../src/map/types';
import { prefabToJson, toPrefab } from '../src/io/exportPrefab';
import { parsePrefab } from '../src/io/importPrefab';
import { validateRoom } from '../src/validate/validate';
import { canonicalMask, neighbourMask, planTileset } from '../src/render/tilesetPlan';

let failures = 0;

/** The 47 canonical neighbour masks, in sheet order. */
const CANONICAL_MASKS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63,
  76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239,
  255,
];

for (const style of LAYOUT_STYLES) {
  for (const preset of SIZE_PRESETS) {
    let ok = 0;
    let attempts = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const base = defaultParams();
      const params = {
        ...base,
        style: { auto: false, value: style },
        size: { ...preset.size },
        exits: { ...base.exits, auto: false },
      };
      const result = generateRoom(params, 1000 + i * 977, defaultMeta());
      attempts += result.attempts;
      if (result.report.ok) ok++;
      else if (i === 0) {
        const bad = result.report.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.message}`);
        console.log(`    first failure -> ${bad.join(' | ')}`);
      }
    }
    if (ok < runs) failures++;
    console.log(
      `${style.padEnd(14)} ${preset.label.padEnd(8)} pass ${ok}/${runs}  avg attempts ${(
        attempts / runs
      ).toFixed(2)}`,
    );
  }
}

// Stress: everything cranked up, all four exits at width 8.
{
  let ok = 0;
  const runs = 20;
  for (let i = 0; i < runs; i++) {
    const base = defaultParams();
    const params = {
      ...base,
      style: { auto: false, value: 'organic' as const },
      obstacleDensity: { auto: false, value: 100 },
      water: { auto: false, enabled: true, density: 60 },
      pits: { auto: false, enabled: true, density: 40 },
      exits: {
        auto: false,
        sides: {
          n: { enabled: true, width: 2 as const, type: 'door' as const, offset: null },
          e: { enabled: true, width: 2 as const, type: 'open' as const, offset: null },
          s: { enabled: true, width: 2 as const, type: 'open' as const, offset: null },
          w: { enabled: true, width: 2 as const, type: 'secret' as const, offset: null },
        },
      },
      markers: { spawn: 12, loot: 6, prop: 20 },
    };
    const result = generateRoom(params, 77 + i * 131, defaultMeta());
    if (result.report.ok) ok++;
  }
  console.log(`stress (dense organic, four exits, water + pits): pass ${ok}/${runs}`);
  if (ok < runs) failures++;
}

// A deliberately broken room must fail validation.
{
  const broken = generateRoom(defaultParams(), 9001, defaultMeta());
  const doc = broken.doc;
  for (let y = 0; y < doc.size.h; y++) {
    for (let x = 0; x < doc.size.w; x++) doc.layers.blocking[y][x] = 'obstacle_high';
  }
  const report = validateRoom(doc);
  console.log(`negative check: ${report.ok ? 'BROKEN - sealed room passed' : 'ok, sealed room fails'}`);
  if (report.ok) failures++;
}

// Auto parameters: rolled from the seed, still deterministic, still valid.
{
  let ok = 0;
  const runs = 60;
  const seen = { water: 0, pits: 0 };
  let minDensity = 100;
  let maxDensity = 0;
  for (let i = 0; i < runs; i++) {
    const result = generateRoom(defaultParams(), 5000 + i * 37, defaultMeta());
    if (result.report.ok) ok++;
    if (result.resolved.water.enabled) seen.water++;
    if (result.resolved.pits.enabled) seen.pits++;
    minDensity = Math.min(minDensity, result.resolved.obstacleDensity);
    maxDensity = Math.max(maxDensity, result.resolved.obstacleDensity);
  }
  const twice = generateRoom(defaultParams(), 5000, defaultMeta());
  const again = generateRoom(defaultParams(), 5000, defaultMeta());
  const stable =
    JSON.stringify(twice.resolved) === JSON.stringify(again.resolved) &&
    prefabToJson(toPrefab(twice.doc)) === prefabToJson(toPrefab(again.doc));
  console.log(
    `auto params: pass ${ok}/${runs}, density ${minDensity}-${maxDensity}%, water in ${seen.water}, pits in ${seen.pits}, repeatable: ${stable ? 'yes' : 'NO'}`,
  );
  if (ok < runs || !stable || minDensity === maxDensity) failures++;
}

// Rolled exits: every room role, every size, still valid and still repeatable.
{
  let ok = 0;
  let runs = 0;
  const counts: Record<number, number> = {};
  let wrongWidth = 0;
  const types: Record<string, number> = {};
  for (const role of ROOM_ROLES) {
    for (const preset of SIZE_PRESETS) {
      for (let i = 0; i < 12; i++) {
        const params = { ...defaultParams(), roomRole: role, size: { ...preset.size } };
        const result = generateRoom(params, 8000 + i * 613, defaultMeta());
        runs++;
        if (result.report.ok) ok++;
        else console.log(`    ${role} ${preset.label} seed ${8000 + i * 613}: ${result.report.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`);
        counts[result.resolved.exits.length] = (counts[result.resolved.exits.length] ?? 0) + 1;
        for (const e of result.resolved.exits) {
          if (e.width !== 2) wrongWidth++;
          types[e.type] = (types[e.type] ?? 0) + 1;
          // Exits must never eat a corner tile.
          const span = e.side === 'n' || e.side === 's' ? result.doc.size.w : result.doc.size.h;
          if (e.offset < 1 || e.offset + e.width > span - 1) failures++;
        }
        // One exit per side at most, so nothing can overlap.
        const sides = result.resolved.exits.map((e) => e.side);
        if (new Set(sides).size !== sides.length) failures++;
      }
    }
  }
  const a = generateRoom(defaultParams(), 8123, defaultMeta());
  const b = generateRoom(defaultParams(), 8123, defaultMeta());
  const repeatable = JSON.stringify(a.resolved.exits) === JSON.stringify(b.resolved.exits);
  console.log(
    `rolled exits: pass ${ok}/${runs}, counts ${JSON.stringify(counts)}, all 2 tiles wide: ${wrongWidth === 0 ? 'yes' : `NO (${wrongWidth})`}, types ${JSON.stringify(types)}, repeatable: ${repeatable ? 'yes' : 'NO'}`,
  );
  if (ok < runs || !repeatable || wrongWidth > 0) failures++;
}

// Role-specific exit rules.
{
  let bad = 0;
  for (let i = 0; i < 40; i++) {
    const deadEnd = generateRoom({ ...defaultParams(), roomRole: 'dead_end' }, 900 + i, defaultMeta());
    if (deadEnd.resolved.exits.length !== 1) bad++;
    const corridor = generateRoom({ ...defaultParams(), roomRole: 'corridor' }, 900 + i, defaultMeta());
    const sides = corridor.resolved.exits.map((e) => e.side).sort().join('');
    if (sides !== 'ns' && sides !== 'ew') bad++;
  }
  console.log(`exit rules per role: ${bad === 0 ? 'ok, dead ends have one, corridors run through' : `BROKEN (${bad})`}`);
  if (bad > 0) failures++;
}

// Claustrophobia: every profile, every level of tightness, still valid.
{
  let ok = 0;
  let runs = 0;
  const openFloor: Record<string, number[]> = {};
  for (const profile of SUBBIOME_PROFILES) {
    for (let i = 0; i < 25; i++) {
      const params = { ...defaultParams(), profile: profile.id, size: { w: 48, h: 32 } };
      const result = generateRoom(params, 4100 + i * 271, defaultMeta());
      runs++;
      if (result.report.ok) ok++;
      else
        console.log(
          `    ${profile.id} seed ${4100 + i * 271} (${result.resolved.style}, c=${result.resolved.claustrophobia}): ${result.report.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`,
        );
    }
  }

  // Tightness has to show up as less open floor in every style, or it is a lie.
  for (const style of LAYOUT_STYLES) {
    const byLevel: number[] = [];
    for (const claustrophobia of [0, 100]) {
      const shares: number[] = [];
      for (let i = 0; i < 12; i++) {
        const base = defaultParams();
        const params = {
          ...base,
          size: { w: 48, h: 32 },
          style: { auto: false, value: style },
          claustrophobia: { auto: false, value: claustrophobia },
        };
        const result = generateRoom(params, 7100 + i * 197, defaultMeta());
        runs++;
        if (result.report.ok) ok++;
        let open = 0;
        for (let y = 0; y < result.doc.size.h; y++)
          for (let x = 0; x < result.doc.size.w; x++)
            if (result.doc.layers.blocking[y][x] === 'void') open++;
        shares.push(open / (result.doc.size.w * result.doc.size.h));
      }
      byLevel.push(shares.reduce((a, b) => a + b, 0) / shares.length);
    }
    const drop = byLevel[0] - byLevel[1];
    console.log(
      `  ${style.padEnd(14)} open floor ${(byLevel[0] * 100).toFixed(0)}% -> ${(byLevel[1] * 100).toFixed(0)}% (tightening removes ${(drop * 100).toFixed(0)} points)`,
    );
    // rooms_in_room fills the room whatever the setting; there claustrophobia
    // changes the grain, not the walkable share, and the fill test below is the
    // one that holds it to account.
    if (style !== 'rooms_in_room' && drop < 0.05) {
      console.log(`  BROKEN: ${style} ignores claustrophobia`);
      failures++;
    }
  }

  // Read the curve off organic: rooms_in_room keeps the room full whatever the
  // setting, so it is the wrong style to ask how tight the space feels.
  for (const claustrophobia of [0, 50, 100]) {
    const shares: number[] = [];
    for (let i = 0; i < 25; i++) {
      const base = defaultParams();
      const params = {
        ...base,
        size: { w: 48, h: 32 },
        style: { auto: false, value: 'organic' as const },
        claustrophobia: { auto: false, value: claustrophobia },
      };
      const result = generateRoom(params, 6100 + i * 331, defaultMeta());
      runs++;
      if (result.report.ok) ok++;
      else
        console.log(
          `    organic c=${claustrophobia} seed ${6100 + i * 331}: ${result.report.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`,
        );
      let open = 0;
      for (let y = 0; y < result.doc.size.h; y++)
        for (let x = 0; x < result.doc.size.w; x++)
          if (result.doc.layers.blocking[y][x] === 'void') open++;
      shares.push(open / (result.doc.size.w * result.doc.size.h));
    }
    openFloor[claustrophobia] = shares;
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const wide = mean(openFloor[0]);
  const mid = mean(openFloor[50]);
  const tight = mean(openFloor[100]);
  console.log(
    `claustrophobia: pass ${ok}/${runs}, open floor 0%=${(wide * 100).toFixed(0)}%, 50%=${(mid * 100).toFixed(0)}%, 100%=${(tight * 100).toFixed(0)}%`,
  );
  if (ok < runs) failures++;
  if (!(wide > mid && mid > tight)) {
    console.log('  BROKEN: tighter settings must leave less open floor');
    failures++;
  }
}

// Decorative scatter has to follow the seed, not sit in the same place forever.
{
  const seeds = new Set<number>();
  for (let i = 0; i < 20; i++) {
    seeds.add(generateRoom(defaultParams(), 3300 + i * 17, defaultMeta()).doc.decorSeed);
  }
  const same = generateRoom(defaultParams(), 3300, defaultMeta()).doc.decorSeed;
  const stable = same === generateRoom(defaultParams(), 3300, defaultMeta()).doc.decorSeed;
  console.log(
    `decor seed: ${seeds.size} distinct over 20 rooms, repeatable: ${stable ? 'yes' : 'NO'}`,
  );
  if (seeds.size < 18 || !stable) failures++;
}

// A pond you cannot reach the bank of is a hole painted inside solid rock. The
// pocket pass walls off the floor around it, and nothing is passable about a
// pit, so without the pool pass the pit itself stays behind in the wall mass.
{
  const strandedLiquid = (doc: { size: { w: number; h: number }; layers: Layers }): number => {
    const { size, layers } = doc;
    const passable = passabilityMask(layers).mask;
    const visited = new Set<number>();
    let count = 0;
    for (let y = 0; y < size.h; y++) {
      for (let x = 0; x < size.w; x++) {
        const ground = layers.ground[y][x];
        if (ground !== 'pit' && ground !== 'water') continue;
        // Buried under something solid: dead on its own.
        if (layers.blocking[y][x] !== 'void') {
          count++;
          continue;
        }
        if (visited.has(y * size.w + x)) continue;
        visited.add(y * size.w + x);
        const queue: Array<[number, number]> = [[x, y]];
        let shore = false;
        let pool = 0;
        while (queue.length > 0) {
          const [cx, cy] = queue.pop() as [number, number];
          pool++;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= size.w || ny >= size.h) continue;
            const ni = ny * size.w + nx;
            if (passable[ni]) shore = true;
            const ng = layers.ground[ny][nx];
            if (visited.has(ni) || layers.blocking[ny][nx] !== 'void') continue;
            if (ng !== 'pit' && ng !== 'water') continue;
            visited.add(ni);
            queue.push([nx, ny]);
          }
        }
        if (!shore) count += pool;
      }
    }
    return count;
  };

  let bad = 0;
  let kept = 0;
  let rooms = 0;
  for (const style of LAYOUT_STYLES) {
    for (const claustrophobia of [20, 60, 95]) {
      for (let i = 0; i < 12; i++) {
        const params = {
          ...defaultParams(),
          size: { w: 48, h: 32 },
          style: { auto: false as const, value: style },
          claustrophobia: { auto: false as const, value: claustrophobia },
          water: { auto: false as const, enabled: true, density: 35 },
          pits: { auto: false as const, enabled: true, density: 35 },
        };
        const doc = generateRoom(params, 8800 + i * 137, defaultMeta()).doc;
        rooms++;
        bad += strandedLiquid(doc);
        for (let y = 0; y < doc.size.h; y++)
          for (let x = 0; x < doc.size.w; x++) {
            const g = doc.layers.ground[y][x];
            if (g === 'pit' || g === 'water') kept++;
          }
      }
    }
  }
  // Maps compose rooms and carve gates through them, so check those too.
  let badOnMaps = 0;
  for (let i = 0; i < 6; i++) {
    const map = generateMap(
      {
        size: { w: 160, h: 120 },
        roomSize: { mode: 'random' as const, w: 24, h: 20 },
        profile: DEFAULT_PROFILE_ID,
        minSubRoom: DEFAULT_SUBROOM_FLOOR,
        loopiness: 30,
        markers: { spawn: 3, loot: 2, prop: 6 },
      },
      5500 + i * 313,
      defaultMeta(),
    );
    badOnMaps += strandedLiquid(map.doc);
  }
  console.log(
    `pits and water: ${bad} stranded over ${rooms} rooms, ${badOnMaps} over 6 maps, ${kept} reachable liquid tile(s) kept`,
  );
  if (bad > 0 || badOnMaps > 0 || kept === 0) failures++;
}

// Walls that form a mass must be walls, not furniture.
{
  let offenders = 0;
  for (const style of LAYOUT_STYLES) {
    for (let i = 0; i < 10; i++) {
      const params = {
        ...defaultParams(),
        size: { w: 48, h: 32 },
        style: { auto: false as const, value: style },
        claustrophobia: { auto: false as const, value: 85 },
      };
      const doc = generateRoom(params, 2200 + i * 53, defaultMeta()).doc;
      // Count obstacles that sit in a 3x3 block of obstacles - that is a wall
      // pretending to be a pile of crates.
      let clumped = 0;
      for (let y = 1; y < doc.size.h - 2; y++) {
        for (let x = 1; x < doc.size.w - 2; x++) {
          let all = true;
          for (let dy = 0; dy < 3 && all; dy++) {
            for (let dx = 0; dx < 3 && all; dx++) {
              const role = doc.layers.blocking[y + dy][x + dx];
              if (role !== 'obstacle_low' && role !== 'obstacle_high') all = false;
            }
          }
          if (all) clumped++;
        }
      }
      if (clumped > 0) offenders++;
    }
  }
  console.log(`obstacle clumps posing as walls: ${offenders === 0 ? 'none' : `${offenders} room(s)`}`);
  if (offenders > 0) failures++;
}

// Whole maps: every room reachable, nothing stranded, repeatable.
{
  let ok = 0;
  let runs = 0;
  let attempts = 0;
  let rooms = 0;
  let links = 0;
  for (const preset of MAP_SIZE_PRESETS) {
    for (const profile of SUBBIOME_PROFILES.map((p) => p.id)) {
      for (let i = 0; i < 6; i++) {
        const result = generateMap(
          {
            size: preset.size,
            roomSize: { mode: 'fixed' as const, w: 24, h: 18 },
            profile,
            minSubRoom: DEFAULT_SUBROOM_FLOOR,
            loopiness: 25,
            markers: { spawn: 3, loot: 1, prop: 4 },
          },
          900 + i * 313,
          defaultMeta(),
        );
        runs++;
        attempts += result.attempts;
        rooms += result.doc.rooms.length;
        links += result.doc.links.length;
        if (result.report.ok) ok++;
        else
          console.log(
            `    map ${preset.label} ${profile} seed ${900 + i * 313}: ${result.report.checks.filter((c) => !c.ok).map((c) => `${c.id} (${c.message})`).join(', ')}`,
          );
      }
    }
  }
  const a = generateMap(
    { size: MAP_SIZE_PRESETS[1].size, roomSize: { mode: 'fixed' as const, w: 24, h: 18 }, profile: 'catacombs', minSubRoom: DEFAULT_SUBROOM_FLOOR, loopiness: 25, markers: { spawn: 3, loot: 1, prop: 4 } },
    4242,
    defaultMeta(),
  );
  const b = generateMap(
    { size: MAP_SIZE_PRESETS[1].size, roomSize: { mode: 'fixed' as const, w: 24, h: 18 }, profile: 'catacombs', minSubRoom: DEFAULT_SUBROOM_FLOOR, loopiness: 25, markers: { spawn: 3, loot: 1, prop: 4 } },
    4242,
    defaultMeta(),
  );
  const repeatable =
    JSON.stringify(a.doc.rooms.map((r) => [r.x, r.y, r.role, r.style])) ===
      JSON.stringify(b.doc.rooms.map((r) => [r.x, r.y, r.role, r.style])) &&
    a.doc.decorSeed === b.doc.decorSeed;

  // Roles the map is supposed to hand out.
  const roles = a.doc.rooms.map((r) => r.role);
  const entrances = roles.filter((r) => r === 'entrance').length;
  const hasWayInAndOut =
    entrances === 1 &&
    a.doc.portals.filter((p) => p.kind === 'entrance').length === 1 &&
    a.doc.portals.filter((p) => p.kind === 'exit').length === 1 &&
    a.doc.rooms[a.doc.exitRoom].role === 'arena';

  // Every room of a map belongs to the subbiome that was asked for.
  const oneBiome = generateMap(
    { size: MAP_SIZE_PRESETS[2].size, roomSize: { mode: 'fixed' as const, w: 24, h: 18 }, profile: 'catacombs', minSubRoom: DEFAULT_SUBROOM_FLOOR, loopiness: 25, markers: { spawn: 3, loot: 1, prop: 4 } },
    777,
    defaultMeta(),
  );
  const profiles = new Set(oneBiome.doc.rooms.map((r) => r.profile));
  const styles = new Set(oneBiome.doc.rooms.map((r) => r.style));
  console.log(
    `subbiome: ${[...profiles].join(', ')} over ${oneBiome.doc.rooms.length} rooms, ${styles.size} layout style(s) among them`,
  );
  if (profiles.size !== 1 || !profiles.has('catacombs') || styles.size < 2) failures++;

  console.log(
    `maps: pass ${ok}/${runs}, avg ${(rooms / runs).toFixed(1)} rooms and ${(links / runs).toFixed(1)} corridors, avg attempts ${(attempts / runs).toFixed(2)}, repeatable: ${repeatable ? 'yes' : 'NO'}, one way in and out through an arena: ${hasWayInAndOut ? 'yes' : 'NO'}`,
  );
  if (ok < runs || !repeatable || !hasWayInAndOut) failures++;
}

// Fixed room sizing has to produce exactly that box, every time.
{
  let ok = 0;
  let runs = 0;
  let offSize = 0;
  for (const [w, h] of [
    [16, 16],
    [24, 18],
    [32, 24],
  ] as Array<[number, number]>) {
    for (let i = 0; i < 8; i++) {
      const result = generateMap(
        {
          size: MAP_SIZE_PRESETS[2].size,
          roomSize: { mode: 'fixed', w, h },
          profile: DEFAULT_PROFILE_ID,
          minSubRoom: DEFAULT_SUBROOM_FLOOR,
          loopiness: 25,
          markers: { spawn: 2, loot: 1, prop: 3 },
        },
        2400 + i * 131,
        defaultMeta(),
      );
      runs++;
      if (result.report.ok) ok++;
      for (const room of result.doc.rooms) {
        if (room.doc.size.w !== w || room.doc.size.h !== h) offSize++;
      }
    }
  }
  console.log(
    `fixed room size: pass ${ok}/${runs}, rooms off the requested box: ${offSize}`,
  );
  if (ok < runs || offSize > 0) failures++;

  // The grid has to fill the map: 240 wide with a 24 wide cell is ten columns.
  const filled = generateMap(
    {
      size: { w: 240, h: 180 },
      roomSize: { mode: 'fixed', w: 24, h: 18 },
      profile: DEFAULT_PROFILE_ID,
      minSubRoom: DEFAULT_SUBROOM_FLOOR,
      loopiness: 25,
      markers: { spawn: 2, loot: 1, prop: 3 },
    },
    31337,
    defaultMeta(),
  );
  const gridOk =
    filled.doc.cols === 10 && filled.doc.rows === 10 && filled.doc.rooms.length === 100;
  console.log(
    `grid fills the map: ${filled.doc.cols} x ${filled.doc.rows} = ${filled.doc.rooms.length} rooms ${gridOk ? '(ok)' : '(BROKEN)'}`,
  );
  if (!gridOk || !filled.report.ok) failures++;

  // Doors are 1 tile, gates are 2, and every door lines up with its neighbour.
  let wrongDoor = 0;
  let misaligned = 0;
  for (const room of filled.doc.rooms) {
    for (const exit of room.doc.exits) {
      // The width is typed to the legal set; this guards the data, not the type.
      const width: number = exit.width;
      if (width !== 1 && width !== 2) wrongDoor++;
    }
  }
  for (const link of filled.doc.links) {
    const [first, second] = link.tiles;
    if (!first || !second) {
      misaligned++;
      continue;
    }
    const adjacent =
      (Math.abs(first[0] - second[0]) === 1 && first[1] === second[1]) ||
      (Math.abs(first[1] - second[1]) === 1 && first[0] === second[0]);
    if (!adjacent) misaligned++;
  }
  const gates = filled.doc.portals.filter((p) => p.tiles.length > 0).length;
  console.log(
    `doors and gates: ${filled.doc.links.length} doors, ${gates} gates, odd widths ${wrongDoor}, misaligned doors ${misaligned}`,
  );
  if (wrongDoor > 0 || misaligned > 0 || gates !== 2) failures++;
}

// Rooms strung along a corridor: chambers have to hang off the spine, not fill it.
{
  let ok = 0;
  const runs = 20;
  let chambersSeen = 0;
  for (let i = 0; i < runs; i++) {
    const params = {
      ...defaultParams(),
      size: { w: 48, h: 32 },
      style: { auto: false as const, value: 'rooms_in_room' as const },
      claustrophobia: { auto: false as const, value: 55 },
    };
    const result = generateRoom(params, 3900 + i * 211, defaultMeta());
    if (result.report.ok) ok++;
    // Count 4x4 blocks of open floor: a room, as opposed to a 2-wide corridor.
    const doc = result.doc;
    let blocks = 0;
    for (let y = 1; y < doc.size.h - 4; y++) {
      for (let x = 1; x < doc.size.w - 4; x++) {
        let all = true;
        for (let dy = 0; dy < 4 && all; dy++) {
          for (let dx = 0; dx < 4 && all; dx++) {
            if (doc.layers.blocking[y + dy][x + dx] !== 'void') all = false;
          }
        }
        if (all) blocks++;
      }
    }
    chambersSeen += blocks;
  }
  console.log(
    `rooms along corridors: pass ${ok}/${runs}, avg ${(chambersSeen / runs).toFixed(0)} open 4x4 blocks per room`,
  );
  if (ok < runs || chambersSeen / runs < 20) failures++;
}

// rooms_in_room has to fill the room: corridors branching into corridors and
// sub-rooms until nothing else fits, not a spine with a few boxes on it.
{
  const report: string[] = [];
  let bad = 0;
  let doorsByLevel: number[] = [];
  for (const claustrophobia of [0, 50, 100]) {
    let unused = 0;
    let interior = 0;
    let doors = 0;
    const runs = 8;
    for (let i = 0; i < runs; i++) {
      const params = {
        ...defaultParams(),
        size: { w: 64, h: 48 },
        style: { auto: false as const, value: 'rooms_in_room' as const },
        claustrophobia: { auto: false as const, value: claustrophobia },
      };
      const doc = generateRoom(params, 8800 + i * 97, defaultMeta()).doc;
      doors += doc.doors.length;
      for (let y = 1; y < doc.size.h - 1; y++) {
        for (let x = 1; x < doc.size.w - 1; x++) {
          interior++;
          if (doc.layers.blocking[y][x] === 'void') continue;
          // Rock more than three tiles from any floor is space nobody built in.
          let near = false;
          for (let dy = -3; dy <= 3 && !near; dy++) {
            for (let dx = -3; dx <= 3 && !near; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 1 || ny < 1 || nx >= doc.size.w - 1 || ny >= doc.size.h - 1) continue;
              if (doc.layers.blocking[ny][nx] === 'void') near = true;
            }
          }
          if (!near) unused++;
        }
      }
    }
    const share = unused / interior;
    doorsByLevel.push(doors / runs);
    report.push(`c=${claustrophobia}: ${(share * 100).toFixed(0)}% unused, ${(doors / runs).toFixed(1)} doors`);
    if (share > 0.2) bad++;
  }
  // Tighter means finer grain: more sub-rooms, so more doors.
  const finer = doorsByLevel[2] > doorsByLevel[0];
  console.log(`rooms_in_room fills the room: ${report.join(' | ')}, tighter is finer: ${finer ? 'yes' : 'NO'}`);
  if (bad > 0 || !finer) failures++;
}

// Sub-rooms are entered through a one-tile door, and that door is walkable.
{
  let rooms = 0;
  let doors = 0;
  let blockedDoors = 0;
  let doorsOnWallLine = 0;
  let stubs = 0;
  for (let i = 0; i < 20; i++) {
    const params = {
      ...defaultParams(),
      size: { w: 48, h: 32 },
      style: { auto: false as const, value: 'rooms_in_room' as const },
      claustrophobia: { auto: false as const, value: 55 },
    };
    const doc = generateRoom(params, 4700 + i * 173, defaultMeta()).doc;
    rooms++;
    doors += doc.doors.length;
    const passable = passabilityMask(doc.layers);
    for (const d of doc.doors) {
      if (!passable.mask[d.y * doc.size.w + d.x]) blockedDoors++;
      // A door is a hole in a wall: the two tiles across it must be solid.
      const across =
        d.axis === 'ns'
          ? [doc.layers.blocking[d.y][d.x - 1], doc.layers.blocking[d.y][d.x + 1]]
          : [doc.layers.blocking[d.y - 1][d.x], doc.layers.blocking[d.y + 1][d.x]];
      if (across.every((role) => role !== 'void')) doorsOnWallLine++;

      // A doorway is one tile of passage, not two. Leave rock between the room
      // and what it hangs off and you get a stub of one-wide corridor in front
      // of every door: the tile beyond the door is open, with solid on both
      // sides of it, which is what this looks for.
      const open = (x: number, y: number): boolean =>
        x >= 0 &&
        y >= 0 &&
        x < doc.size.w &&
        y < doc.size.h &&
        doc.layers.blocking[y][x] === 'void';
      const beyond: Array<[number, number]> =
        d.axis === 'ns'
          ? [
              [d.x, d.y - 1],
              [d.x, d.y + 1],
            ]
          : [
              [d.x - 1, d.y],
              [d.x + 1, d.y],
            ];
      for (const [nx, ny] of beyond) {
        const pinched =
          open(nx, ny) &&
          (d.axis === 'ns'
            ? !open(nx - 1, ny) && !open(nx + 1, ny)
            : !open(nx, ny - 1) && !open(nx, ny + 1));
        if (pinched) {
          stubs++;
          break;
        }
      }
    }
  }
  console.log(
    `sub-room doors: ${(doors / rooms).toFixed(1)} per room, blocked ${blockedDoors}, standing in a wall ${doorsOnWallLine}/${doors}, with a one-wide stub in front ${stubs}/${doors}`,
  );
  // Every door, not most: a door with a gap beside it is not a door.
  if (doors / rooms < 3 || blockedDoors > 0 || doorsOnWallLine < doors) failures++;
  // A few are incidental - a later sub-room walls in the tile the door opens
  // onto. A passage built that way would put one in front of nearly every door.
  if (stubs / doors > 0.1) failures++;
}

// The smallest sub-room is a setting, so it has to show: raise the floor and the
// same room has to come back with fewer, larger chambers.
{
  const doorsFor = (minSubRoom: number): number => {
    let doors = 0;
    const runs = 12;
    for (let i = 0; i < runs; i++) {
      const params = {
        ...defaultParams(),
        size: { w: 48, h: 32 },
        style: { auto: false as const, value: 'rooms_in_room' as const },
        claustrophobia: { auto: false as const, value: 60 },
        minSubRoom,
      };
      doors += generateRoom(params, 9100 + i * 151, defaultMeta()).doc.doors.length;
    }
    return doors / runs;
  };
  const sizes = [2, 3, 6, 10];
  const counts = sizes.map(doorsFor);
  console.log(
    `smallest sub-room: ${sizes.map((n, i) => `${n}x${n}: ${counts[i].toFixed(1)} doors`).join(' | ')}`,
  );
  let monotonic = true;
  for (let i = 1; i < counts.length; i++) if (counts[i] >= counts[i - 1]) monotonic = false;
  if (!monotonic) {
    console.log('  BROKEN: a bigger minimum must leave fewer sub-rooms');
    failures++;
  }
}

// Doors are supposed to land where both rooms already have somewhere to stand,
// so you walk from room into room rather than down a passage dug to meet you.
{
  let agreed = 0;
  let dug = 0;
  let gatesAgreed = 0;
  let gates = 0;
  for (let i = 0; i < 8; i++) {
    const map = generateMap(
      {
        size: { w: 160, h: 120 },
        roomSize: { mode: 'random' as const, w: 24, h: 20 },
        profile: DEFAULT_PROFILE_ID,
        minSubRoom: DEFAULT_SUBROOM_FLOOR,
        loopiness: 25,
        markers: { spawn: 3, loot: 2, prop: 6 },
      },
      2200 + i * 613,
      defaultMeta(),
    ).doc;
    for (const link of map.links) {
      if (link.agreed) agreed++;
      else dug++;
    }
    for (const portal of map.portals) {
      gates++;
      if (portal.agreed) gatesAgreed++;
    }
  }
  const share = agreed / (agreed + dug);
  console.log(
    `doors onto a chamber both rooms offered: ${agreed}/${agreed + dug} (${(share * 100).toFixed(0)}%), gates ${gatesAgreed}/${gates}`,
  );
  // Caves have rock against the wall and offer almost nothing, so a third is
  // what a mixed map can manage; well under that means the openings are broken.
  if (share < 0.25) failures++;
}

// There has to be a way through: the entrance and the exit are joined by a walk
// the player can actually take, and it is at most as long as the map is big.
{
  let maps = 0;
  let missing = 0;
  let total = 0;
  let shortest = Infinity;
  for (let i = 0; i < 12; i++) {
    const map = generateMap(
      {
        size: { w: 160, h: 120 },
        roomSize: { mode: 'random' as const, w: 24, h: 20 },
        profile: DEFAULT_PROFILE_ID,
        minSubRoom: DEFAULT_SUBROOM_FLOOR,
        loopiness: 30,
        markers: { spawn: 3, loot: 2, prop: 6 },
      },
      7700 + i * 197,
      defaultMeta(),
    );
    maps++;
    const route = shortestRoute(map.doc);
    if (route.length === 0) {
      missing++;
      continue;
    }
    total += route.length;
    shortest = Math.min(shortest, route.length);
    // Every step is one tile, and every tile of it is walkable.
    const passable = passabilityMask(map.doc.layers).mask;
    for (let step = 0; step < route.length; step++) {
      const [x, y] = route[step];
      if (!passable[y * map.doc.size.w + x]) missing++;
      if (step === 0) continue;
      const [px, py] = route[step - 1];
      if (Math.abs(px - x) + Math.abs(py - y) !== 1) missing++;
    }
  }
  console.log(
    `entrance to exit: avg ${(total / maps).toFixed(0)} tiles, shortest ${shortest}, broken ${missing} over ${maps} maps`,
  );
  if (missing > 0) failures++;
}

// Gates belong to the first and last room of a map; room openings carry nothing.
{
  const map = generateMap(
    {
      size: { w: 160, h: 120 },
      roomSize: { mode: 'fixed', w: 20, h: 20 },
      profile: 'catacombs',
      minSubRoom: DEFAULT_SUBROOM_FLOOR,
      loopiness: 30,
      markers: { spawn: 2, loot: 1, prop: 3 },
    },
    5150,
    defaultMeta(),
  );
  const fixtures = mapFixtures(map.doc);
  const doors = fixtures.filter((f) => f.kind === 'door').length;
  const gates = fixtures.filter((f) => f.kind === 'gate').length;
  const passable = passabilityMask(map.doc.layers);
  let floating = 0;
  for (const f of fixtures) {
    if (!passable.mask[f.y * map.doc.size.w + f.x]) floating++;
  }
  const doorsFromRooms = map.doc.rooms.reduce((sum, r) => sum + r.doc.doors.length, 0);
  console.log(
    `fixtures: ${doors} sub-room doors and ${gates} gates, floating in rock: ${floating}, doors come from rooms: ${doors === doorsFromRooms ? 'yes' : 'NO'}`,
  );
  if (gates !== 2 || floating > 0 || doors !== doorsFromRooms) failures++;
}

// Determinism: same seed, same params, identical JSON.
const a = generateRoom(defaultParams(), 4242, defaultMeta());
const b = generateRoom(defaultParams(), 4242, defaultMeta());
const sameSeed = prefabToJson(toPrefab(a.doc)) === prefabToJson(toPrefab(b.doc));
console.log(`determinism: ${sameSeed ? 'ok' : 'BROKEN'}`);
if (!sameSeed) failures++;

// Round trip: export, import, export again.
const json = prefabToJson(toPrefab(a.doc));
const roundTrip = prefabToJson(toPrefab(parsePrefab(json)));
console.log(`round trip: ${roundTrip === json ? 'ok' : 'BROKEN'}`);
if (roundTrip !== json) failures++;

// Tileset manifests: both the tool's own shape and the game asset-pack shape.
{
  const own = planTileset({
    tileSize: 32,
    fixtures: {
      door_ns: ['door_ns.png'],
      door_ew: ['door_ew.png'],
      gate_ns: ['gate_ns.png'],
      gate_ew: ['gate_ew.png'],
      portcullis: ['nope.png'],
    },
    roles: {
      floor: ['a.png', { file: 'rare.png', weight: 1 }, { file: 'common.png', weight: 6 }],
      deco: ['x.png'],
    },
    decals: [
      { file: 'bones.png', on: 'floor', density: 0.06 },
      { file: 'grit.png', on: 'floor', density: 0.05, jitter: 0.4 },
      { file: 'pinned.png', on: 'wall', density: 0.05, jitter: 0 },
      { file: 'silly.png', on: 'floor', density: 0.05, jitter: 9 },
      { file: 'moss.png', on: 'deco', density: 0.1 },
    ],
  });
  const ownOk =
    own.tileSize === 32 &&
    own.files.floor?.length === 8 &&
    own.files.floor?.filter((f) => f === 'common.png').length === 6 &&
    Object.keys(own.fixtures).length === 4 &&
    own.notes.some((n) => n.includes('portcullis')) &&
    own.decals.length === 4 &&
    own.decals[0].on === 'floor' &&
    own.decals[0].jitter === 0.22 &&
    own.decals[1].jitter === 0.4 &&
    own.decals[2].jitter === 0 &&
    own.decals[3].jitter === 0.5 &&
    own.notes.some((n) => n.includes('deco'));
  console.log(`manifest (roles map): ${ownOk ? 'ok' : 'BROKEN'}`);
  if (!ownOk) failures++;

  // Verbatim from the katakumby pack.
  const pack = planTileset({
    tile_size: 32,
    blob: {
      columns: 8,
      count: 47,
      wall: 'wall_blob47.png',
      water: 'water_blob47.png',
      masks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255],
    },
    textures: [
      { file: 'floor.png', role: 'floor', weight: 8 },
      { file: 'floor_damaged.png', role: 'floor', weight: 1 },
      { file: 'wall_top.png', role: 'wall', weight: 1 },
      { file: 'wall_face.png', role: 'wall', weight: 1 },
      { file: 'ceiling.png', role: 'overlay', weight: 1 },
      { file: 'water.png', role: 'water', weight: 1 },
    ],
    objects: [
      { file: 'objects/burial_niche.png', role: 'deco' },
      { file: 'objects/sarcophagus.png', role: 'obstacle_low' },
      { file: 'objects/urn.png', role: 'obstacle_low' },
      { file: 'objects/bones.png', role: 'deco' },
      { file: 'objects/grate.png', role: 'obstacle_high' },
      { file: 'objects/torch.png', role: 'deco' },
    ],
  });
  const packOk =
    pack.files.floor?.length === 9 &&
    pack.files.floor?.filter((f) => f === 'floor_damaged.png').length === 1 &&
    pack.files.obstacle_low?.length === 2 &&
    pack.files.obstacle_high?.length === 1 &&
    pack.blobs.wall?.file === 'wall_blob47.png' &&
    pack.blobs.water?.masks.length === 47 &&
    pack.notes.filter((n) => n.includes('layer, not a tile role')).length === 4;
  console.log(`manifest (asset pack): ${packOk ? 'ok' : 'BROKEN'}`);
  if (!packOk) failures++;

  // The shape the tileset-prompts.md spec produces: roles map plus nested blob47.
  const spec = planTileset({
    tileSize: 32,
    roles: {
      floor: ['floor_01.png', 'floor_02.png', 'floor_03.png', 'floor_04.png'],
      wall: ['wall_01.png', 'wall_02.png'],
      obstacle_low: ['obstacle_low_01.png', 'obstacle_low_02.png', 'obstacle_low_03.png'],
      obstacle_high: ['obstacle_high_01.png', 'obstacle_high_02.png'],
      pit: ['pit_01.png', 'pit_02.png'],
      water: ['water_01.png', 'water_02.png'],
      hazard: ['hazard_01.png', 'hazard_02.png'],
    },
    blob47: {
      wall: { sheet: 'wall_blob47.png', masks: CANONICAL_MASKS },
      water: { sheet: 'water_blob47.png', masks: CANONICAL_MASKS },
    },
  });
  const specOk =
    Object.keys(spec.files).length === 7 &&
    spec.files.floor?.length === 4 &&
    spec.files.hazard?.length === 2 &&
    spec.blobs.wall?.file === 'wall_blob47.png' &&
    spec.blobs.wall?.columns === null &&
    spec.blobs.water?.masks.length === 47 &&
    spec.notes.length === 0;
  console.log(`manifest (subbiome spec): ${specOk ? 'ok' : 'BROKEN'}`);
  if (!specOk) failures++;

  // Every canonical mask must reduce to itself, and reductions must land in the table.
  const masks = pack.blobs.wall?.masks ?? [];
  const table = new Set(masks);
  let maskErrors = 0;
  for (const m of masks) if (canonicalMask(m) !== m) maskErrors++;
  for (let raw = 0; raw < 256; raw++) if (!table.has(canonicalMask(raw))) maskErrors++;
  console.log(`blob47 masks: ${maskErrors === 0 ? 'ok, all 256 combinations resolve' : `BROKEN (${maskErrors})`}`);
  if (maskErrors > 0) failures++;

  // A lone tile has no neighbours; a tile inside solid ground has all eight.
  const solid = () => true;
  const empty = () => false;
  const lone = neighbourMask(4, 4, 10, 10, empty, false);
  const full = neighbourMask(4, 4, 10, 10, solid, true);
  const corner = neighbourMask(0, 0, 10, 10, solid, false);
  // Top-left corner with nothing outside: E, S and the SE diagonal only.
  const maskOk = lone === 0 && full === 255 && corner === 2 + 4 + 32;
  console.log(`neighbour masks: ${maskOk ? 'ok' : `BROKEN (${lone}, ${full}, ${corner})`}`);
  if (!maskOk) failures++;
}

console.log(failures === 0 ? 'ALL GOOD' : `${failures} problem group(s)`);
