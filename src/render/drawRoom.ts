import type { LayerName, MarkerKind, TileGrid } from '../types/prefab';
import type { EditorView, RoomDoc } from '../types/editor';
import { exitTiles } from '../gen/outline';
import type { ValidationReport } from '../validate/validate';
import {
  BASE_TILE_PX,
  CANVAS_BG,
  CHUNK_COLOR,
  ROCK_COLOR,
  ROUTE_COLOR,
  DOOR_COLOR,
  EXIT_COLOR,
  GATE_COLOR,
  GRATE_COLOR,
  GRID_COLOR,
  MARKER_COLORS,
  PROBLEM_COLOR,
  ROLE_COLORS,
} from './palette';
import { hashTile, hashUnit } from '../core/rng';
import {
  neighbourMask,
  variantFor,
  type FixtureKey,
  type TileImage,
  type Tileset,
} from './tileset';

/**
 * Something standing in a gap in the wall: where it is and which way the wall
 * runs through it.
 *
 * Doors and gates come from the layout; grates come off the blocking layer,
 * because a grate is a tile role and only its art needs to know the direction.
 */
export interface Fixture {
  kind: 'door' | 'gate' | 'grate';
  /** 'ns' means the wall runs east-west and you pass north-south. */
  orientation: 'ns' | 'ew';
  /** Top-left tile. A gate covers two tiles along the wall. */
  x: number;
  y: number;
  /** Door only: bars on both sides of it rather than blockwork. */
  grated?: boolean;
}

/** The art a fixture asks the pack for. */
function fixtureKey(fixture: Fixture): FixtureKey {
  const base = `${fixture.kind}_${fixture.orientation}`;
  return (fixture.kind === 'door' && fixture.grated ? `${base}_grate` : base) as FixtureKey;
}

/**
 * Grates, read off the blocking layer.
 *
 * The orientation is the door convention: 'ns' means you would walk through it
 * north to south, so the wall it stands in runs east-west. Which it is follows
 * from where the floor is, and where the layout gives no answer - a lone tile
 * of bars - from the run of wall it sits in.
 */
function grateFixtures(grid: TileGrid): Fixture[] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h;
  const open = (x: number, y: number): boolean => inside(x, y) && grid[y][x] === 'void';
  const solid = (x: number, y: number): boolean => !inside(x, y) || grid[y][x] !== 'void';
  const out: Fixture[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] !== 'grate') continue;
      const orientation: 'ns' | 'ew' =
        open(x, y - 1) && open(x, y + 1)
          ? 'ns'
          : open(x - 1, y) && open(x + 1, y)
            ? 'ew'
            : solid(x - 1, y) && solid(x + 1, y)
              ? 'ns'
              : 'ew';
      out.push({ kind: 'grate', orientation, x, y });
    }
  }
  return out;
}

/** A door, a gate or a grate, drawn over the tiles it stands in. */
function drawFixture(
  g: CanvasRenderingContext2D,
  fixture: Fixture,
  tile: number,
  tileset: Tileset | null,
): void {
  const span = fixture.kind === 'gate' ? 2 : 1;
  const w = fixture.orientation === 'ns' ? span : 1;
  const h = fixture.orientation === 'ns' ? 1 : span;
  const art = tileset?.fixtures[fixtureKey(fixture)];
  if (art && art.length > 0) {
    const entry = variantFor(art, fixture.x, fixture.y);
    g.drawImage(entry.img, fixture.x * tile, fixture.y * tile, w * tile, h * tile);
    return;
  }
  // No art: a band across the opening, so a door still reads as a door.
  g.fillStyle =
    fixture.kind === 'gate' ? GATE_COLOR : fixture.kind === 'grate' ? GRATE_COLOR : DOOR_COLOR;
  g.globalAlpha = 0.85;
  g.fillRect(fixture.x * tile, fixture.y * tile, w * tile, h * tile);
  g.globalAlpha = 1;
}

export interface DrawOptions {
  doc: RoomDoc;
  view: EditorView;
  report: ValidationReport | null;
  tileset: Tileset | null;
  hover: { x: number; y: number } | null;
  /**
   * Doors and gates, which the layout decides. Grates are not in here: they
   * are tiles, and are read straight off the blocking layer.
   */
  fixtures: Fixture[];
  /** The shortest way from the entrance to the exit, tile by tile. */
  route: Array<[number, number]>;
  /** devicePixelRatio the backing store was sized with. */
  dpr: number;
}

const LAYER_ORDER: LayerName[] = ['ground', 'blocking', 'deco', 'overlay'];

/**
 * Tile edges snapped to whole device pixels.
 *
 * A tile is `32 * zoom` CSS pixels and the zoom is continuous, so tile edges
 * land mid-pixel at almost any zoom. The canvas then antialiases each tile
 * against the one beside it, and wherever the rounding tips the same way down a
 * whole column you get that seam running through the floor and on through the
 * wall. Snapping both edges to the device grid - and taking the next tile's
 * left edge as this tile's right edge - leaves no gap to antialias.
 */
function snapper(dpr: number): (value: number) => number {
  return (value: number) => Math.round(value * dpr) / dpr;
}

/**
 * A wall with wall on all eight sides is rock nobody sees the face of.
 *
 * A grate beside it is not wall for this purpose even though it is for
 * autotiling: you can see straight through bars, so the stone behind them is
 * stone the player looks at.
 */
function buriedInRock(grid: TileGrid, x: number, y: number, w: number, h: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      // Outside the room is more rock, so the border reads as solid too.
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] !== 'wall') return false;
    }
  }
  return true;
}

/** Square art fills the tile; taller or wider art is fitted, bottom anchored. */
function drawTileImage(
  g: CanvasRenderingContext2D,
  entry: TileImage,
  tile: number,
  x: number,
  y: number,
  snap: (value: number) => number,
  offsetX = 0,
  offsetY = 0,
): void {
  if (entry.square) {
    const x0 = snap(x * tile + offsetX);
    const y0 = snap(y * tile + offsetY);
    g.drawImage(
      entry.img,
      x0,
      y0,
      snap((x + 1) * tile + offsetX) - x0,
      snap((y + 1) * tile + offsetY) - y0,
    );
    return;
  }
  const scale = Math.min(tile / entry.w, tile / entry.h);
  const dw = entry.w * scale;
  const dh = entry.h * scale;
  g.drawImage(
    entry.img,
    snap(x * tile + (tile - dw) / 2 + offsetX),
    snap(y * tile + tile - dh + offsetY),
    snap(dw),
    snap(dh),
  );
}

/** Scatter decorations over the tiles of a layer, straight from the position. */
function drawDecals(
  g: CanvasRenderingContext2D,
  grid: TileGrid,
  tile: number,
  tileset: Tileset,
  decorSeed: number,
  snap: (value: number) => number,
): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const list = tileset.decals[grid[y][x]];
      if (!list) continue;
      // Nothing is scattered on rock the player never sees the face of.
      if (grid[y][x] === 'wall' && buriedInRock(grid, x, y, w, h)) continue;
      for (const decal of list) {
        const salt = (decal.salt * 2654435761 + decorSeed) | 0;
        if (hashUnit(x, y, salt) >= decal.density) continue;
        // Nudged off the tile centre, deterministically, so the grid stops showing.
        const dx = (hashUnit(x, y, salt + 7919) * 2 - 1) * decal.jitter * tile;
        const dy = (hashUnit(x, y, salt + 104729) * 2 - 1) * decal.jitter * tile;
        drawTileImage(g, decal.image, tile, x, y, snap, Math.round(dx), Math.round(dy));
      }
    }
  }
}

function drawLayer(
  g: CanvasRenderingContext2D,
  grid: TileGrid,
  tile: number,
  tileset: Tileset | null,
  alpha: number,
  snap: (value: number) => number,
  /**
   * Tiles a door, a gate or a grate stands in. The tile itself is not stone -
   * it is what you walk through, or what you see through - but the wall it is
   * cut into does not end there, so for autotiling it counts as wall. Without
   * this the wall on either side is drawn as a wall that stops, and the gap
   * reads as two loose ends rather than as a hole in a run of wall.
   */
  doorways: Set<number> = new Set(),
): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const fill = (x: number, y: number, color: string): void => {
    const x0 = snap(x * tile);
    const y0 = snap(y * tile);
    g.fillStyle = color;
    g.fillRect(x0, y0, snap((x + 1) * tile) - x0, snap((y + 1) * tile) - y0);
  };
  g.globalAlpha = alpha;
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const role = row[x];
      if (role === 'void') continue;
      // Bars are drawn with the doors, over the floor showing through them.
      if (role === 'grate') continue;

      // Rock with rock on every side has no face to light, so there is nothing
      // to draw but the dark. It also keeps the wall mass reading as depth.
      if (role === 'wall' && buriedInRock(grid, x, y, w, h)) {
        fill(x, y, ROCK_COLOR);
        continue;
      }

      // Autotiled terrain first: pick the variant that matches the neighbours.
      const blob = tileset?.blobs[role];
      if (blob) {
        // Outside the room counts as more wall, so the border reads as solid.
        const mask = neighbourMask(
          x,
          y,
          w,
          h,
          (nx, ny) => grid[ny][nx] === role || (role === 'wall' && doorways.has(ny * w + nx)),
          role === 'wall',
        );
        const index = blob.index.get(mask);
        if (index !== undefined) {
          const sx = (index % blob.columns) * blob.tileSize;
          const sy = Math.floor(index / blob.columns) * blob.tileSize;
          const dx = snap(x * tile);
          const dy = snap(y * tile);
          // Which sheet, when the pack brought more than one, follows the tile
          // position - the same trick the flat variants use, and for the same
          // reason: a wall drawn from one sheet reads as one wall.
          const sheet = blob.imgs[hashTile(x, y, 0x5eed) % blob.imgs.length];
          g.drawImage(
            sheet,
            sx,
            sy,
            blob.tileSize,
            blob.tileSize,
            dx,
            dy,
            snap((x + 1) * tile) - dx,
            snap((y + 1) * tile) - dy,
          );
          continue;
        }
      }

      const images = tileset?.images[role];
      if (images && images.length > 0) {
        drawTileImage(g, variantFor(images, x, y), tile, x, y, snap);
      } else {
        fill(x, y, ROLE_COLORS[role]);
      }
    }
  }
  g.globalAlpha = 1;
}

function drawMarkerGlyph(
  g: CanvasRenderingContext2D,
  kind: MarkerKind,
  x: number,
  y: number,
  tile: number,
  extra?: number,
): void {
  const cx = x * tile + tile / 2;
  const cy = y * tile + tile / 2;
  const r = tile * 0.3;
  g.strokeStyle = MARKER_COLORS[kind];
  g.fillStyle = MARKER_COLORS[kind];
  g.lineWidth = Math.max(1, tile * 0.08);
  g.beginPath();
  switch (kind) {
    case 'spawn':
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy + r);
      g.lineTo(cx - r, cy + r);
      g.closePath();
      g.fill();
      break;
    case 'loot':
      g.rect(cx - r, cy - r, r * 2, r * 2);
      g.fill();
      break;
    case 'prop':
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      break;
    case 'objective':
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.stroke();
      break;
    case 'light':
      g.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      g.fill();
      if (extra && extra > 0) {
        g.globalAlpha = 0.25;
        g.beginPath();
        g.arc(cx, cy, extra * tile, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
      break;
  }
}

export function drawRoom(g: CanvasRenderingContext2D, opts: DrawOptions): void {
  const { doc, view, report, tileset, dpr } = opts;
  const tile = BASE_TILE_PX * view.zoom;
  const width = doc.size.w * tile;
  const height = doc.size.h * tile;

  // Everything below is in CSS pixels; the dpr scale stays in the transform.
  const snap = snapper(dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Pixel art: no smoothing, or every tile bleeds into the one beside it.
  g.imageSmoothingEnabled = false;
  g.fillStyle = CANVAS_BG;
  g.fillRect(0, 0, g.canvas.width / dpr, g.canvas.height / dpr);
  // A fractional pan puts every tile back on half a pixel however well the
  // tiles themselves are snapped.
  g.translate(snap(view.panX), snap(view.panY));

  g.fillStyle = '#101318';
  g.fillRect(0, 0, width, height);

  // Where a doorway or a grate pierces the wall, so the wall can be drawn as
  // carrying on through it rather than as two ends facing each other.
  const grates = grateFixtures(doc.layers.blocking);
  const doorways = new Set<number>();
  for (const fixture of [...opts.fixtures, ...grates]) {
    const span = fixture.kind === 'gate' ? 2 : 1;
    for (let i = 0; i < span; i++) {
      const fx = fixture.orientation === 'ns' ? fixture.x + i : fixture.x;
      const fy = fixture.orientation === 'ns' ? fixture.y : fixture.y + i;
      if (fx < 0 || fy < 0 || fx >= doc.size.w || fy >= doc.size.h) continue;
      doorways.add(fy * doc.size.w + fx);
    }
  }

  for (const name of LAYER_ORDER) {
    if (!view.visibility[name]) continue;
    const alpha = name === 'deco' || name === 'overlay' ? 0.85 : 1;
    drawLayer(g, doc.layers[name], tile, tileset, alpha, snap, doorways);
    // Bars stand in the blocking layer but are drawn like a door, over the
    // floor that shows through them - so they follow that layer's own toggle
    // rather than the one for doors and gates the layout put in.
    if (name === 'blocking') {
      for (const grate of grates) drawFixture(g, grate, tile, tileset);
    }
    // Decorations sit on top of the layer that carries their role.
    if (tileset && view.visibility.decals && (name === 'ground' || name === 'blocking')) {
      drawDecals(g, doc.layers[name], tile, tileset, doc.decorSeed, snap);
    }
  }

  if (view.visibility.validation && report && report.problemTiles.length > 0) {
    g.fillStyle = PROBLEM_COLOR;
    for (const [x, y] of report.problemTiles) g.fillRect(x * tile, y * tile, tile, tile);
  }

  if (view.visibility.exits) {
    g.strokeStyle = EXIT_COLOR;
    g.lineWidth = Math.max(2, tile * 0.12);
    for (const exit of doc.exits) {
      const tiles = exitTiles(doc.size, exit);
      for (const [x, y] of tiles) {
        g.strokeRect(x * tile + g.lineWidth / 2, y * tile + g.lineWidth / 2, tile - g.lineWidth, tile - g.lineWidth);
      }
      const [fx, fy] = tiles[0] ?? [0, 0];
      if (tile >= 14) {
        g.fillStyle = EXIT_COLOR;
        g.font = `${Math.round(tile * 0.4)}px monospace`;
        g.fillText(`${exit.side}:${exit.type}`, fx * tile + 2, fy * tile + tile * 0.9);
      }
    }
  }

  if (view.visibility.grid && tile >= 6) {
    g.strokeStyle = GRID_COLOR;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= doc.size.w; x++) {
      g.moveTo(Math.round(x * tile) + 0.5, 0);
      g.lineTo(Math.round(x * tile) + 0.5, height);
    }
    for (let y = 0; y <= doc.size.h; y++) {
      g.moveTo(0, Math.round(y * tile) + 0.5);
      g.lineTo(width, Math.round(y * tile) + 0.5);
    }
    g.stroke();
  }

  if (view.visibility.chunkLines) {
    g.strokeStyle = CHUNK_COLOR;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= doc.size.w; x += 8) {
      g.moveTo(Math.round(x * tile) + 0.5, 0);
      g.lineTo(Math.round(x * tile) + 0.5, height);
    }
    for (let y = 0; y <= doc.size.h; y += 8) {
      g.moveTo(0, Math.round(y * tile) + 0.5);
      g.lineTo(width, Math.round(y * tile) + 0.5);
    }
    g.stroke();
  }

  if (view.visibility.fixtures) {
    for (const fixture of opts.fixtures) drawFixture(g, fixture, tile, tileset);
  }

  // Under the markers, over the tiles: the run from the entrance to the exit.
  if (view.visibility.route && opts.route.length > 1) {
    g.strokeStyle = ROUTE_COLOR;
    g.lineWidth = Math.max(1.5, tile * 0.3);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.globalAlpha = 0.75;
    g.beginPath();
    opts.route.forEach(([x, y], i) => {
      const cx = x * tile + tile / 2;
      const cy = y * tile + tile / 2;
      if (i === 0) g.moveTo(cx, cy);
      else g.lineTo(cx, cy);
    });
    g.stroke();
    g.globalAlpha = 1;
  }

  if (view.visibility.markers) {
    for (const m of doc.markers.spawn) drawMarkerGlyph(g, 'spawn', m.x, m.y, tile);
    for (const m of doc.markers.loot) drawMarkerGlyph(g, 'loot', m.x, m.y, tile);
    for (const m of doc.markers.prop) drawMarkerGlyph(g, 'prop', m.x, m.y, tile);
    for (const m of doc.markers.objective) drawMarkerGlyph(g, 'objective', m.x, m.y, tile);
    for (const m of doc.markers.light) drawMarkerGlyph(g, 'light', m.x, m.y, tile, m.radius);
  }

  if (opts.hover) {
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1;
    g.strokeRect(opts.hover.x * tile + 0.5, opts.hover.y * tile + 0.5, tile - 1, tile - 1);
  }

  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, width - 1, height - 1);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
