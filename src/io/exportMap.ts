import type { PrefabMeta } from '../types/editor';
import type { MapDoc } from '../map/types';
import { prefabToJson, toPrefab } from './exportPrefab';

const NL = '\n';

function portalLines(map: MapDoc): string[] {
  return map.portals.map(
    (p) =>
      `    { "kind": ${JSON.stringify(p.kind)}, "room": ${p.room}, "side": ${JSON.stringify(p.side)} }`,
  );
}

function linkLines(map: MapDoc): string[] {
  return map.links.map((link) => `    { "from": ${link.from}, "to": ${link.to} }`);
}

/**
 * A map is not a prefab, so it gets its own shape: where each room sits, which
 * rooms a corridor joins, where the dungeon is entered and left, and the full
 * prefab for every room so the file stands on its own.
 */
export function mapToJson(map: MapDoc, meta: PrefabMeta): string {
  const rooms = map.rooms.map((room) => {
    const prefab = prefabToJson(toPrefab(room.doc))
      .trimEnd()
      .split(NL)
      .map((line) => `      ${line}`)
      .join(NL);
    return [
      '    {',
      `      "index": ${room.index},`,
      `      "x": ${room.x},`,
      `      "y": ${room.y},`,
      `      "role": ${JSON.stringify(room.role)},`,
      `      "profile": ${JSON.stringify(room.profile)},`,
      `      "style": ${JSON.stringify(room.style)},`,
      `      "claustrophobia": ${room.claustrophobia},`,
      '      "prefab":',
      prefab,
      '    }',
    ].join(NL);
  });

  return [
    '{',
    `  "id": ${JSON.stringify(meta.id)},`,
    `  "size": ${JSON.stringify(map.size)},`,
    `  "decor_seed": ${map.decorSeed},`,
    `  "entrance_room": ${map.entranceRoom},`,
    `  "exit_room": ${map.exitRoom},`,
    '  "portals": [',
    portalLines(map).join(`,${NL}`),
    '  ],',
    `  "biome_tags": ${JSON.stringify(meta.biome_tags)},`,
    `  "subbiome_tags": ${JSON.stringify(meta.subbiome_tags)},`,
    '  "rooms": [',
    rooms.join(`,${NL}`),
    '  ],',
    '  "links": [',
    linkLines(map).join(`,${NL}`),
    '  ]',
    '}',
    '',
  ].join(NL);
}

/** Cheap summary for the on-screen preview - the full map JSON is enormous. */
export function mapSummaryJson(map: MapDoc, meta: PrefabMeta): string {
  const rooms = map.rooms.map(
    (room) =>
      `    { "index": ${room.index}, "x": ${room.x}, "y": ${room.y}, "w": ${room.doc.size.w}, "h": ${room.doc.size.h}, "role": ${JSON.stringify(room.role)}, "profile": ${JSON.stringify(room.profile)}, "style": ${JSON.stringify(room.style)}, "claustrophobia": ${room.claustrophobia} }`,
  );
  return [
    '// preview only - Download writes every room prefab in full',
    '{',
    `  "id": ${JSON.stringify(meta.id)},`,
    `  "size": ${JSON.stringify(map.size)},`,
    `  "decor_seed": ${map.decorSeed},`,
    `  "entrance_room": ${map.entranceRoom},`,
    `  "exit_room": ${map.exitRoom},`,
    '  "portals": [',
    portalLines(map).join(`,${NL}`),
    '  ],',
    '  "rooms": [',
    rooms.join(`,${NL}`),
    '  ],',
    '  "links": [',
    linkLines(map).join(`,${NL}`),
    '  ]',
    '}',
    '',
  ].join(NL);
}
