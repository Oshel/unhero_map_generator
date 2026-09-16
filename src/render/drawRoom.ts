import type { LayerName, MarkerKind, TileGrid } from '../types/prefab';
import type { EditorView, RoomDoc } from '../types/editor';
import { exitTiles } from '../gen/outline';
import type { ValidationReport } from '../validate/validate';
import {
  BASE_TILE_PX,
  CANVAS_BG,
  CHUNK_COLOR,
  DOOR_COLOR,
  EXIT_COLOR,
  GATE_COLOR,
  GRID_COLOR,
  MARKER_COLORS,
  PROBLEM_COLOR,
  ROLE_COLORS,
} from './palette';
import { hashUnit } from '../core/rng';
import {
  neighbourMask,
  variantFor,
  type FixtureKey,
  type TileImage,
  type Tileset,
} from './tileset';

/** A door or gate to draw: where it is and which way you walk through it. */
export interface Fixture {
  kind: 'door' | 'gate';
  /** 'ns' means the wall runs east-west and you pass north-south. */
  orientation: 'ns' | 'ew';
  /** Top-left tile. A gate covers two tiles along the wall. */
  x: number;
  y: number;
}

export interface DrawOptions {
  doc: RoomDoc;
  view: EditorView;
  report: ValidationReport | null;
  tileset: Tileset | null;
  hover: { x: number; y: number } | null;
  /** Doors and gates, drawn over the tiles they stand in. */
  fixtures: Fixture[];
  /** devicePixelRatio the backing store was sized with. */
  dpr: number;
}

const LAYER_ORDER: LayerName[] = ['ground', 'blocking', 'deco', 'overlay'];

/** Square art fills the tile; taller or wider art is fitted, bottom anchored. */
function drawTileImage(
  g: CanvasRenderingContext2D,
  entry: TileImage,
  tile: number,
  x: number,
  y: number,
  offsetX = 0,
  offsetY = 0,
): void {
  if (entry.square) {
    g.drawImage(entry.img, x * tile + offsetX, y * tile + offsetY, tile, tile);
    return;
  }
  const scale = Math.min(tile / entry.w, tile / entry.h);
  const dw = entry.w * scale;
  const dh = entry.h * scale;
  g.drawImage(
    entry.img,
    x * tile + (tile - dw) / 2 + offsetX,
    y * tile + tile - dh + offsetY,
    dw,
    dh,
  );
}

/** Scatter decorations over the tiles of a layer, straight from the position. */
function drawDecals(
  g: CanvasRenderingContext2D,
  grid: TileGrid,
  tile: number,
  tileset: Tileset,
  decorSeed: number,
): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const list = tileset.decals[grid[y][x]];
      if (!list) continue;
      for (const decal of list) {
        const salt = (decal.salt * 2654435761 + decorSeed) | 0;
        if (hashUnit(x, y, salt) >= decal.density) continue;
        // Nudged off the tile centre, deterministically, so the grid stops showing.
        const dx = (hashUnit(x, y, salt + 7919) * 2 - 1) * decal.jitter * tile;
        const dy = (hashUnit(x, y, salt + 104729) * 2 - 1) * decal.jitter * tile;
        drawTileImage(g, decal.image, tile, x, y, Math.round(dx), Math.round(dy));
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
): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  g.globalAlpha = alpha;
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const role = row[x];
      if (role === 'void') continue;

      // Autotiled terrain first: pick the variant that matches the neighbours.
      const blob = tileset?.blobs[role];
      if (blob) {
        // Outside the room counts as more wall, so the border reads as solid.
        const mask = neighbourMask(x, y, w, h, (nx, ny) => grid[ny][nx] === role, role === 'wall');
        const index = blob.index.get(mask);
        if (index !== undefined) {
          const sx = (index % blob.columns) * blob.tileSize;
          const sy = Math.floor(index / blob.columns) * blob.tileSize;
          g.drawImage(
            blob.img,
            sx,
            sy,
            blob.tileSize,
            blob.tileSize,
            x * tile,
            y * tile,
            tile,
            tile,
          );
          continue;
        }
      }

      const images = tileset?.images[role];
      if (images && images.length > 0) {
        drawTileImage(g, variantFor(images, x, y), tile, x, y);
      } else {
        g.fillStyle = ROLE_COLORS[role];
        g.fillRect(x * tile, y * tile, tile, tile);
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
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = CANVAS_BG;
  g.fillRect(0, 0, g.canvas.width / dpr, g.canvas.height / dpr);
  g.translate(view.panX, view.panY);

  g.fillStyle = '#101318';
  g.fillRect(0, 0, width, height);

  for (const name of LAYER_ORDER) {
    if (!view.visibility[name]) continue;
    const alpha = name === 'deco' || name === 'overlay' ? 0.85 : 1;
    drawLayer(g, doc.layers[name], tile, tileset, alpha);
    // Decorations sit on top of the layer that carries their role.
    if (tileset && view.visibility.decals && (name === 'ground' || name === 'blocking')) {
      drawDecals(g, doc.layers[name], tile, tileset, doc.decorSeed);
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

  if (view.visibility.fixtures && opts.fixtures.length > 0) {
    for (const fixture of opts.fixtures) {
      const key = `${fixture.kind}_${fixture.orientation}` as FixtureKey;
      const art = tileset?.fixtures[key];
      const span = fixture.kind === 'gate' ? 2 : 1;
      const w = fixture.orientation === 'ns' ? span : 1;
      const h = fixture.orientation === 'ns' ? 1 : span;
      if (art && art.length > 0) {
        const entry = variantFor(art, fixture.x, fixture.y);
        g.drawImage(entry.img, fixture.x * tile, fixture.y * tile, w * tile, h * tile);
        continue;
      }
      // No art: a band across the opening, so a door still reads as a door.
      g.fillStyle = fixture.kind === 'gate' ? GATE_COLOR : DOOR_COLOR;
      g.globalAlpha = 0.85;
      g.fillRect(fixture.x * tile, fixture.y * tile, w * tile, h * tile);
      g.globalAlpha = 1;
    }
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
