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
2. **Load folder** under TILESET and point it at a tileset directory (`examples/katakumby_astra_ultra` is a complete one, grates included; `examples/katakumby_astra_light` is the same subbiome without them). The preview swaps flat colours for the real art. The browser asks for permission to read the folder; nothing leaves the tab.
3. Wheel zooms, dragging pans, **Space** rolls a new seed, **G** toggles the grid.
4. **Download JSON** writes the prefab.

The tileset has to be picked again after a reload - the tool deliberately remembers nothing between sessions.

## Layout

- `src/types/prefab.ts` - the schema shared with the game, including `decor_seed`. Copy verbatim into `packages/shared`.
- `src/types/editor.ts` - tool-only state (document, view, visibility).
- `src/core/` - rng (mulberry32), grids, passability, flood fill, erosion.
- `src/gen/` - constants, parameters, subbiome profiles, exit rolling, shell and exit geometry, the three layout styles, liquids, markers, retry loop.
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
| `blocking` | `wall` `grate` `obstacle_low` `obstacle_high` `void` |
| `deco`, `overlay` | anything - purely visual |

A tile is walkable when `blocking` is `void` and `ground` is `floor` or `hazard`.
`pit` and `water` block movement; `hazard` hurts but is crossable.

A `grate` is a wall of bars: it blocks movement like any other wall, but you see
through it and shoot through it, so a fight carries across it. `blocksSight` and
`blocksProjectiles` in `core/passability.ts` are what say so. Only the
`rooms_in_room` layout places them, in stretches of 2 to 5 tiles, and only in a
wall that has somewhere to stand on both sides of it - between two sub-rooms, or
between a sub-room and a corridor. How many is the "Grates" slider.

A doorway is flanked by grates on both sides or on neither; `RoomDoor.grated`
says which, and the pack draws those doors from `door_ns_grate` /
`door_ew_grate` instead of `door_ns` / `door_ew`.

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
offset, the obstacle density, how much of the wall between chambers is bars
rather than stone, and whether there is water or pits and how much. Each group
can be pinned by hand in the left panel, which always reports what the seed
actually chose.

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

Exits are not decided first. The interior is built before the room has any way
in or out, and it reports every offset on each side where an opening would land
straight on walkable floor - a chamber or a corridor standing against the shell.
A rolled exit is then snapped onto one of those offsets, so it opens into a room
rather than into rock, and breaching the wall costs a single tile. Only where
nothing is offered - or where a map has pinned the offset because the room next
door agreed to it - does the opening pass dig inward until it meets open floor.

That order is also what lets a map hang a door where both neighbours already
have a chamber against the shared wall. An additive style gets one guaranteed
open hall in the middle, carved after the style has run so nothing can close it;
a subtractive style digs its own corridors and joins the exits itself, so it
skips the hall.

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

How a pack is produced in the first place - every tile, its prompt and the
checks it has to pass - is [docs/tileset-prompts.md](docs/tileset-prompts.md).

**Own shape** - one square PNG per variant, role to files:

```json
{
  "tileSize": 32,
  "roles": {
    "floor": ["floor.png", "floor_damaged.png"],
    "wall": ["wall_top.png"],
    "obstacle_low": ["sarcophagus.png", "urn.png"],
    "obstacle_high": ["pillar.png"],
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
- `fixtures` are what stands in a gap in the wall, drawn over the tiles rather
  than in them: `door_ns`, `door_ew`, `door_ns_grate`, `door_ew_grate`,
  `gate_ns`, `gate_ew`, `grate_ns`, `grate_ew`.
  A door is 32x32 and fills the one-tile doorway into a sub-room; a gate spans the
  two tiles of a map entrance, so `gate_ns` is 64x32 and `gate_ew` is 32x64.
  A grate is 32x32 and needs real transparency between its bars - the floor and
  whatever stands beyond it show through. `grate` is a tile role but has no flat
  variants: its art depends on which way the wall runs, so it is drawn from the
  fixture that names the direction and never appears under `roles`.
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

A role may name several sheets - `{ "wall": { "sheets": ["a.png", "b.png"],
"masks": [...] } }` - cut the same way and holding the same masks in the same
order. The sheet is then picked per tile from the tile position, so a long wall
stops reading as one face repeated. A sheet cut differently from the first is
skipped with a note rather than quietly meaning something else.

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
from each out to the map edge. A few treasure rooms, the rest normal.

Every room of a map belongs to the one subbiome you pick, and the picker offers
only subbiomes that are places - "no profile" is the escape hatch for working on
a single room and is withheld from maps. What does vary room to room is the
layout style and the claustrophobia, and they are laid out across the whole grid
at once rather than rolled independently: no two rooms you can walk between are
the same kind of space, and each option still gets about the same share of the
map.

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

## Role, profile, style

Three words that all sound like "what kind of room is this" and mean different
things.

**Room role** is what the room *is* to the level: `entrance`, `normal`, `arena`,
`treasure`, `dead_end`, `corridor`, `boss`, `exit`. It is the only one of the
three that goes into the prefab, and the game reads it when it builds a level -
how many of these may appear, where they may sit, what happens in them. In the
tool it decides one thing: how many exits the room gets, and it nudges the exit
type (a `locked` door is far more likely on a `treasure` room).

| Role | Exits |
|---|---|
| `dead_end` | 1 |
| `corridor` | 2, on opposite sides |
| `treasure`, `boss` | 1, sometimes 2 |
| `entrance`, `exit` | 1, sometimes 2 |
| `arena` | 2 to 4 |
| `normal` | 2 to 4, usually 2 |

**Subbiome profile** is how the space of that subbiome is *shaped*: the odds of
each layout style plus the ranges for claustrophobia and obstacle density. It is
an input to generation, not an output - it never appears in a prefab. It is also
not the tileset: the tileset says how a subbiome looks, the profile says how it
is built, and keeping them apart means the same catacombs can be tight or roomy
without touching a single PNG.

**Style** is the *method* used to draw the floor plan: `open`, `rooms_in_room`,
`organic`. Like the profile it is a way of producing the room rather than a
property of it, so it stays out of the prefab; the map export records it per
room as a note on where that room came from.

```
subbiome profile  --rolls-->  style + claustrophobia + obstacle density
                                          |
room role         --sets-->   exits       |
                                          v
                              the generator draws the floor plan
                                          |
tileset           --dresses->  the finished room
```

A prefab therefore carries the role and not the profile or the style: the game is
told "this is an arena with two exits", not "this was carved out of rock at 82%
claustrophobia".

Today the role only affects exits. It does not force an arena to be larger or a
treasure room to carry more loot markers - worth wiring up when the game starts
caring.

## Subbiome profiles and claustrophobia

A subbiome does not only look different, it is shaped differently - catacombs are
a warren, a great hall is a hall. That lives in `src/gen/profiles.ts` as a typed
table, ready to move into `content/subbiomes/*.json` once the game owns the
generator. A profile gives the odds of each layout style plus the ranges for
claustrophobia and obstacle density.

**Claustrophobia**, 0 to 100, is the one number that decides how the space feels.
It sets how much rock `organic` starts from, how much rubble `open` scatters,
and the size range of the chambers `rooms_in_room` packs - which in turn decides
how many of them there are and how many doorways the room ends up with.
Corridors are two tiles wide whatever the setting; that is a fixed decision, not
a dial. Measured over 48x32 rooms, going from 0 to 100 takes the walkable share
of the room from 67% down to 15%.

Every style answers to it, though not equally:

| Style | Mode | 0 -> 100 walkable share |
|---|---|---|
| `rooms_in_room` | subtractive | 54% -> 53%, the grain changes instead |
| `organic` | additive | 67% -> 12% |
| `open` | additive | 88% -> 80% |

`rooms_in_room` is the only subtractive style, and the only one where tightening
changes the grain rather than the amount of floor. It builds a route and then
packs rooms around it:

1. A **main corridor**, two tiles wide, from the first exit to the last. It does
   not take the shortest path - it wanders through three or four turns, so the
   room has a route through it rather than a diagonal.
2. **At most two side corridors**, also two tiles wide, branching off it.
3. **Rooms fill everything else.** A room hangs off any floor tile - a corridor
   or a room already placed - keeps its own wall, and is entered through a single
   one-tile doorway. As space runs out the pieces being tried shrink, so the room
   ends up filled: measured on 64x48, 13% of the interior is left as rock nobody
   built in at claustrophobia 0, and only 1-2% once it tightens and the pieces
   get small enough to pack.

Every corridor is the same two tiles wide, main one included: a grand hall down
the middle reads as a different kind of place entirely.

Sub-rooms come from here. Each keeps its wall and its one doorway, and those
doorways are what the prefab records in `doors` and what the door graphic is
drawn on - along with `grated`, which says whether that doorway stands in bars
rather than stone. Claustrophobia changes the grain rather than the fill -
roughly 23 doors per 64x48 room at 0 against 65 at 100, the same space cut into
more, smaller pieces.

**Additive** styles start from an empty room and drop obstacles into it.
**Subtractive** styles start from solid rock and carve the room out of it - only
the latter produces real corridors and wall mass, which is why a tight profile
leans on them. A subtractive style also joins every exit itself, so the generator
does not additionally drive corridors from each exit to the middle the way it
does for the additive ones.

## Canvas controls

| Input | Action |
|---|---|
| Drag | pan |
| Wheel | zoom 25% - 400% |
| `Space` | roll a new seed |
| `G` | toggle the grid |

The canvas is a preview. Rooms are produced by the generator and inspected here;
import exists so an existing prefab can be re-checked and re-exported.
