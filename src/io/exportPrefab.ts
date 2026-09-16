import type { LayerName, RoomPrefab, TileGrid } from '../types/prefab';
import { LAYER_NAMES } from '../types/prefab';
import type { RoomDoc } from '../types/editor';

export function toPrefab(doc: RoomDoc): RoomPrefab {
  return {
    id: doc.meta.id,
    size: { w: doc.size.w, h: doc.size.h },
    decor_seed: doc.decorSeed,
    role: doc.meta.role,
    biome_tags: [...doc.meta.biome_tags],
    subbiome_tags: [...doc.meta.subbiome_tags],
    weight: doc.meta.weight,
    exits: doc.exits.map((e) => ({ ...e })),
    doors: doc.doors.map((d) => ({ ...d })),
    layers: {
      ground: doc.layers.ground.map((r) => [...r]),
      blocking: doc.layers.blocking.map((r) => [...r]),
      deco: doc.layers.deco.map((r) => [...r]),
      overlay: doc.layers.overlay.map((r) => [...r]),
    },
    markers: {
      spawn: doc.markers.spawn.map((m) => ({ ...m })),
      loot: doc.markers.loot.map((m) => ({ ...m })),
      prop: doc.markers.prop.map((m) => ({ ...m })),
      objective: doc.markers.objective.map((m) => ({ ...m })),
      light: doc.markers.light.map((m) => ({ ...m })),
    },
    constraints: { ...doc.meta.constraints },
  };
}

function gridToJson(grid: TileGrid, indent: string): string {
  const rows = grid.map((row) => `${indent}  ${JSON.stringify(row)}`);
  return `[\n${rows.join(',\n')}\n${indent}]`;
}

/**
 * Pretty JSON, but with one tile row per line so prefabs stay diffable.
 * Parses back to exactly the same object as `JSON.stringify` would produce.
 */
export function prefabToJson(prefab: RoomPrefab): string {
  const head = [
    `  "id": ${JSON.stringify(prefab.id)}`,
    `  "size": ${JSON.stringify(prefab.size)}`,
    `  "decor_seed": ${JSON.stringify(prefab.decor_seed)}`,
    `  "role": ${JSON.stringify(prefab.role)}`,
    `  "biome_tags": ${JSON.stringify(prefab.biome_tags)}`,
    `  "subbiome_tags": ${JSON.stringify(prefab.subbiome_tags)}`,
    `  "weight": ${JSON.stringify(prefab.weight)}`,
    `  "exits": [\n${prefab.exits.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`,
  ];

  const layers = LAYER_NAMES.map(
    (name: LayerName) => `    ${JSON.stringify(name)}: ${gridToJson(prefab.layers[name], '    ')}`,
  ).join(',\n');

  const markerLines = (
    Object.entries(prefab.markers) as Array<[string, Array<Record<string, unknown>>]>
  ).map(
    ([kind, list]) =>
      `    ${JSON.stringify(kind)}: [${list.map((m) => JSON.stringify(m)).join(', ')}]`,
  );

  return [
    '{',
    head.join(',\n') + ',',
    `  "layers": {\n${layers}\n  },`,
    `  "markers": {\n${markerLines.join(',\n')}\n  },`,
    `  "constraints": ${JSON.stringify(prefab.constraints)}`,
    '}',
    '',
  ].join('\n');
}
