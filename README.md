# Room Prefab Generator

Dev tool for authoring room prefabs for the dungeon stitcher. Generates a seeded
room - or a whole map of stitched rooms - validates it, previews it with the
biome's art, and exports the JSON the game consumes. The generator is the author - there is no hand editing, since
this logic is headed for the in-game room generator. No engine code, no backend,
no localStorage.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Vite serves it at http://localhost:5180 and reloads on every change. Ctrl+C stops it.

| Command | What it does |
|---|---|
| `npm run dev` | dev server at http://localhost:5180 |
| `npm run smoke` | headless run: every style, size and room role, determinism, JSON round trip, tileset manifests |
| `npm run typecheck` | types only, no build |
| `npm run build` | production bundle into `dist/` |

## First five minutes

1. **Generate**, or **New seed** for a fresh one. The right panel validates the room as it appears.
2. **Load folder** under TILESET and point it at a tileset directory (for example `../katakumby`). The preview swaps flat colours for the real art. The browser asks for permission to read the folder; nothing leaves the tab.
3. Wheel zooms, dragging pans, **Space** rolls a new seed, **G** toggles the grid.
4. **Download JSON** writes the prefab.

The tileset has to be picked again after a reload - the tool deliberately remembers nothing between sessions.

## Layout

- `src/types/prefab.ts` - the schema shared with the game, including `decor_seed`. Copy verbatim into `packages/shared`.
- `src/types/editor.ts` - tool-only state (document, view, visibility).
- `src/core/` - rng (mulberry32), grids, passability, flood fill, erosion.
- `src/gen/` - constants, parameters, subbiome profiles, exit rolling, shell and exit geometry, the six layout styles, liquids, markers, retry loop.
- `src/validate/` - the five room rules and the report.
- `src/map/` - map layout: the room grid, doors, gates, composition, map-level validation.
- `src/render/` - colour palette, canvas renderer, optional tileset loader.
- `src/io/` - export, import, file download.
- `src/ui/` - three-column layout.

## Conventions

Tiles carry **roles**, never tileset indices, so a prefab works in any biome.

`ground` and `blocking` hold disjoint role sets:

| layer | roles |
|---|---|
| `ground` | `floor` `pit` `water` `hazard` `void` |
| `blocking` | `wall` `obstacle_low` `obstacle_high` `void` |
| `deco`, `overlay` | anything - purely visual |

A tile is walkable when `blocking` is `void` and `ground` is `floor` or `hazard`.
`pit` and `water` block movement; `hazard` hurts but is crossable.

Exit `offset` is measured from the left edge (`n`/`s`) or the top edge (`e`/`w`),
and never covers a corner tile. An opening between two rooms is 2 tiles wide and
carries nothing; the gate in and out of a map is also 2 tiles but has a gate in
it. The 1-tile doorways with doors in them are inside a room, between it and its
sub-rooms.

## Generation

`generateRoom(params, seed, meta)` is deterministic: same seed plus same
parameters always yields the same room. If validation fails it retries with
`seed + 1`, up to 50 attempts, and reports how many it took.

Rolled from the seed by default - and rerolled on every retry: the layout style,
how claustrophobic the room is, which sides carry an exit, their width, type and
offset, the obstacle density, and whether there is water or pits and how much. Each group can be pinned by hand in the left panel,
which always reports what the seed actually chose.

How many exits follows the room role, so a rolled room still makes sense as a
piece of a level:

| Role | Exits |
|---|---|
| `dead_end` | 1 |
| `corridor` | 2, on opposite sides |
| `treasure`, `boss` | 1, sometimes 2 |
| `entrance`, `exit` | 1, sometimes 2 |
| `arena` | 2 to 4 |
| everything else | 2 to 4, usually 2 |

Every opening between rooms is 2 tiles wide, on any side. `locked` is more likely
on a treasure room than anywhere else.

Every exit gets a guaranteed apron plus a corridor to the middle of the room -
2 tiles wide in the tightest subbiomes, up to 6 in the most open ones. Layout
styles paint around those, which is why rooms come out connected on the first
attempt in practice. Subtractive styles skip the spokes and join the exits
themselves.

## Validation

1. All exits connected (flood fill over walkable tiles).
2. No walkable tile cut off from the exits.
3. Markers stand on walkable tiles and are reachable from the exits.
4. Exits are 2 tiles wide, lie inside their side and do not overlap.
5. The outline is sealed except at the exits.

There is no minimum corridor width rule: how tight a passage may be is a design
decision, made by the subbiome profile, not something validation should police.

## Optional tileset

The preview draws flat colours per role by default. "Load folder" accepts a
directory containing `tiles.json` plus the PNGs. Two manifest shapes are read.

**Own shape** - one square PNG per variant, role to files:

```json
{
  "tileSize": 32,
  "roles": {
    "floor": ["floor.png", "floor_damaged.png"],
    "wall": ["wall_top.png"],
    "obstacle_low": ["sarcophagus.png", "urn.png"],
    "obstacle_high": ["grate.png"],
    "water": ["water.png"]
  }
}
```

**Asset-pack shape** - files to role, with weights and optional blob47 sheets:

```json
{
  "tile_size": 32,
  "blob": { "columns": 8, "wall": "wall_blob47.png", "masks": [0, 1, 2, "..."] },
  "textures": [{ "file": "floor.png", "role": "floor", "weight": 8 }],
  "objects": [{ "file": "objects/urn.png", "role": "obstacle_low" }]
}
```

Rules that apply to both:

- Paths are relative to the picked folder; subfolders work.
- Keys must be tile roles. `deco` and `overlay` are layers, not roles - entries
  using them are skipped and the reason is listed under the tileset section.
- Several files per role are variants, picked deterministically from a hash of
  the tile position, so the preview never shimmers and no lattice appears.
  A variant may be `"file.png"` or `{ "file": "...", "weight": 1..8 }`.
- `fixtures` are what you walk through, drawn over the tiles rather than in them:
  `{ "door_ns": ["door_ns.png"], "door_ew": [...], "gate_ns": [...], "gate_ew": [...] }`.
  A door is 32x32 and fills the one-tile doorway into a sub-room; a gate spans the
  two tiles of a map entrance, so `gate_ns` is 64x32 and `gate_ew` is 32x64.
  Without them the preview draws a coloured band across the opening.
- `decals` scatter small decorations over the tiles of a role:
  `{ "file": "bones.png", "on": "floor", "density": 0.06, "jitter": 0.22 }`.
  They are painted from the tile position and never touch the prefab, so a room
  stays portable between biomes. `jitter` is the fraction of a tile a decal may
  sit off centre (default 0.22, clamped to 0.5) - without it the scatter lands
  on the grid and reads as a pattern.
- Square art fills the tile. Taller or wider art (wall facing, a two-tile
  sarcophagus) is scaled to fit and anchored to the bottom of the tile.
- A missing file or an undecodable PNG falls back to the flat colour.
- A UTF-8 BOM in `tiles.json` is tolerated.

**Autotiling.** When `blob` names a sheet for a role, that role is drawn from the
sheet instead of a single tile: the eight-neighbour mask is reduced to the
canonical 47 (a diagonal counts only when both of its orthogonal neighbours are
present), looked up in `masks`, and the array position is the tile index -
`sx = (index % columns) * tileSize`, `sy = floor(index / columns) * tileSize`.
Outside the room counts as more wall, so the border reads as solid; for other
roles it counts as empty.

Tiles are always previewed at 32 px times the zoom; `tileSize` only splits blob
sheets. Nothing is remembered between sessions, so pick the folder again after a
reload.

## Two modes

The switch above the seed decides what a roll produces.

**One room** tunes a single prefab: you pick the size, role and exits, the seed
fills in the rest, and Download writes one prefab.

**Whole map** lays out an entire level as a **grid of rooms**. Set the cell - say
24 x 18 - and a 240 x 180 map becomes exactly 10 x 10 = 100 rooms, edge to edge,
no gaps and no corridors between them. The order matters and is the point:

1. **Fill the map with rooms.** Cells tile the map; leftovers become an even
   margin. The cell is yours when `Room size` is `fixed`, or rolled once by the
   seed and then used for every room.
2. **Place the doors**, on the walls two rooms share. A random spanning tree over
   the grid guarantees the dungeon is walkable; `Extra doors` decides how many
   more go in beyond that minimum, which is what turns a tree into a place with
   choices. Each opening is two tiles, and both rooms get it at the same spot, so
   the two openings line up exactly. Nothing hangs in them - the only gates on a
   map are the two at the ends.
3. **Then generate the interiors**, each room built with its doors already pinned
   in place. The room generator guarantees a path to every one of them, so the
   layout serves the doors rather than the doors being punched into whatever the
   layout happened to produce.

On top of that the map picks its roles: one `entrance` and one `arena` on the rim
of the grid, as far apart as the door graph allows, with a 2-tile gate running
from each out to the map edge. A few treasure rooms, the rest normal. On the
default `Mixed` profile each room also rolls its own subbiome.

Map validation is its own set of rules, and they are about exploration:

1. One way in and one way out, both reaching the map edge, the exit inside the
   final arena.
2. Every room reachable from the entrance.
3. No walkable tile stranded anywhere on the map - not one dead pocket.
4. Every room actually has a door.

Rooms also get the same treatment internally: any walkable pocket a style leaves
behind that no exit can reach is filled in with rock before the room is finished.
An island the player can never stand on is dead space the game would still
decorate and spawn around.

`Download JSON` in map mode writes the map: size, decor seed, which room is the
entrance and which the exit, the gates, every room with its position, profile and
full prefab, and the door list. The on-screen preview shows
a trimmed version, since the real file carries every tile of every room.

## Subbiome profiles and claustrophobia

A subbiome does not only look different, it is shaped differently - catacombs are
a warren, a great hall is a hall. That lives in `src/gen/profiles.ts` as a typed
table, ready to move into `content/subbiomes/*.json` once the game owns the
generator. A profile gives the odds of each layout style plus the ranges for
claustrophobia and obstacle density.

**Claustrophobia**, 0 to 100, is the one number that decides how the space feels.
It drives corridor width (6 tiles down to 2), chamber size and count, wall
thickness, how many doorways a chamber wall gets, and how much of the room stays
solid rock. Measured over 48x32 rooms, going from 0 to 100 takes the walkable
share of the room from 49% down to 24%.

Every style answers to it, though not equally:

| Style | Mode | 0 -> 100 walkable share |
|---|---|---|
| `rooms_in_room` | subtractive | 29% -> 25%, the grain changes instead |
| `corridors` | subtractive | 46% -> 22% |
| `organic` | additive | 69% -> 14% |
| `symmetric` | additive | 88% -> 73% |
| `open` | additive | 88% -> 76% |
| `pillars` | additive | 89% -> 81% |

**Additive** styles start from an empty room and drop obstacles into it.
**Subtractive** styles start from solid rock and carve the room out of it - only
the latter produces real corridors and wall mass, which is why a tight profile
leans on them.

The two subtractive styles differ in what the skeleton is. `corridors` scatters
chambers and joins them with a spanning tree, so it reads as a warren.

`rooms_in_room` builds a route and then packs rooms around it:

1. A **main corridor**, two tiles wide, from the first exit to the last. It does
   not take the shortest path - it wanders through three or four turns, so the
   room has a route through it rather than a diagonal.
2. **At most two side corridors**, also two tiles wide, branching off it.
3. **Rooms fill everything else.** A room hangs off any floor tile - a corridor
   or a room already placed - keeps its own wall, and is entered through a single
   one-tile doorway. As space runs out the pieces being tried shrink, so the room
   ends up filled: measured on 64x48, about 11-15% of the interior is left as
   rock nobody built in.

Every corridor is the same two tiles wide, main one included: a grand hall down
the middle reads as a different kind of place entirely.

Sub-rooms come from here. Each keeps its wall and its one doorway, and those
doorways are what the prefab records in `doors` and what the door graphic is drawn
on. Claustrophobia changes the grain rather than the fill - roughly 23 doors per
64x48 room at 0 against 56 at 100, the same space cut into more, smaller pieces.

**Additive** styles start from an empty room and drop obstacles into it.
**Subtractive** styles start from solid rock and carve the room out of it - only
the latter produces real corridors and wall mass, which is why a tight profile
leans on them.

The two subtractive styles differ in what the skeleton is. `corridors` scatters
chambers and joins them with a spanning tree, so it reads as a warren.

`rooms_in_room` grows instead. A spine runs from the first exit to the others,
and then it branches, over and over: a branch is either a **sub-room** - walled,
entered through a single one-tile doorway - or another **two-tile corridor**,
which can be branched from in turn. It keeps going until nothing fits any more,
and as space runs out the pieces it tries get smaller, so the room ends up filled
rather than stopping with a quarter of it untouched. Measured on 64x48 rooms,
about 10% of the interior is left as rock nobody built in.

That is where sub-rooms come from: each keeps its own wall and one doorway, and
those doorways are what the prefab records in `doors` and what the door graphic is
drawn on. Claustrophobia changes the grain rather than the fill - roughly 9 doors
per room at 0 against 25 at 100, the same space cut into more, smaller pieces. A subtractive style joins every exit itself
(spanning tree over chambers and exits, plus a loop or two), so the generator does
not also drive corridors from each exit to the middle the way it does for additive
styles.

## Canvas controls

| Input | Action |
|---|---|
| Drag | pan |
| Wheel | zoom 25% - 400% |
| `Space` | roll a new seed |
| `G` | toggle the grid |

The canvas is a preview. Rooms are produced by the generator and inspected here;
import exists so an existing prefab can be re-checked and re-exported.
