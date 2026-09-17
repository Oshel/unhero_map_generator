import type { TileRole } from '../types/prefab';
import { hashTile } from '../core/rng';
import {
  planTileset,
  type BlobPlan,
  type DecalPlan,
  type FixtureKey,
  type TilesetPlan,
} from './tilesetPlan';

export { neighbourMask, canonicalMask } from './tilesetPlan';
export type { TilesetPlan, FixtureKey } from './tilesetPlan';

export interface TileImage {
  img: HTMLImageElement;
  w: number;
  h: number;
  /** Tall or wide art (wall facing, sarcophagus) is fitted into the tile. */
  square: boolean;
}

export interface BlobSheet {
  /**
   * Sheets cut to the same grid and holding the same masks. More than one means
   * the same terrain drawn in different stone, picked per tile so that a long
   * wall does not read as one face repeated.
   */
  imgs: HTMLImageElement[];
  columns: number;
  tileSize: number;
  /** mask value -> tile index in the sheet. */
  index: Map<number, number>;
}

export interface Decal extends DecalPlan {
  image: TileImage;
  /** Keeps two decals on the same role from landing on the same tiles. */
  salt: number;
}

export interface Tileset {
  name: string;
  tileSize: number;
  images: Partial<Record<TileRole, TileImage[]>>;
  blobs: Partial<Record<TileRole, BlobSheet>>;
  /** Grouped by role so the renderer does not filter per tile. */
  decals: Partial<Record<TileRole, Decal[]>>;
  /** Doors and gates: what you walk through, drawn over the tiles. */
  fixtures: Partial<Record<FixtureKey, TileImage[]>>;
  notes: string[];
}

function relativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = rel.split('/');
  // Drop the folder the user picked; manifest paths are relative to it.
  return (parts.length > 1 ? parts.slice(1).join('/') : file.name).toLowerCase();
}

/** Editors on Windows like to write a BOM; JSON.parse chokes on it. */
export function parseJson(text: string): unknown {
  return JSON.parse(text.replace(/^﻿/, ''));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not decode ${file.name}`));
    img.src = url;
  });
}

async function buildTileset(
  plan: TilesetPlan,
  byPath: Map<string, File>,
  name: string,
): Promise<Tileset> {
  const notes = [...plan.notes];
  const cache = new Map<string, HTMLImageElement>();

  const get = async (path: string): Promise<HTMLImageElement | null> => {
    const key = path.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;
    const file = byPath.get(key);
    if (!file) {
      notes.push(`${path}: not in the folder - skipped`);
      return null;
    }
    try {
      const img = await loadImage(file);
      cache.set(key, img);
      return img;
    } catch {
      notes.push(`${path}: could not be decoded - skipped`);
      return null;
    }
  };

  const images: Tileset['images'] = {};
  for (const [role, paths] of Object.entries(plan.files) as Array<[TileRole, string[]]>) {
    const loaded: TileImage[] = [];
    for (const path of paths) {
      const img = await get(path);
      if (!img) continue;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      loaded.push({ img, w, h, square: w === h });
    }
    if (loaded.length > 0) images[role] = loaded;
  }

  const blobs: Tileset['blobs'] = {};
  for (const [role, blob] of Object.entries(plan.blobs) as Array<[TileRole, BlobPlan]>) {
    const imgs: HTMLImageElement[] = [];
    let columns = 0;
    let tileSize = 0;
    for (const file of blob.files) {
      const img = await get(file);
      if (!img) continue;
      // Columns are optional: with tileSize known, the sheet width gives them away.
      const cols = blob.columns ?? Math.max(1, Math.round(img.naturalWidth / plan.tileSize));
      const size = Math.round(img.naturalWidth / cols);
      const cells = cols * Math.max(1, Math.round(img.naturalHeight / size));
      if (blob.masks.length > cells) {
        notes.push(`${file}: ${blob.masks.length} masks but only ${cells} cells - skipped`);
        continue;
      }
      // Variants have to be cut alike, or the same mask would mean two things.
      if (imgs.length > 0 && (cols !== columns || size !== tileSize)) {
        notes.push(`${file}: cut differently from the first sheet of this role - skipped`);
        continue;
      }
      columns = cols;
      tileSize = size;
      imgs.push(img);
    }
    if (imgs.length === 0) continue;
    const index = new Map<number, number>();
    blob.masks.forEach((mask, i) => index.set(mask, i));
    blobs[role] = { imgs, columns, tileSize, index };
  }

  const decals: Tileset['decals'] = {};
  let salt = 1;
  for (const decal of plan.decals) {
    const img = await get(decal.file);
    if (!img) continue;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const list = decals[decal.on] ?? [];
    list.push({ ...decal, salt: salt++, image: { img, w, h, square: w === h } });
    decals[decal.on] = list;
  }

  const fixtures: Tileset['fixtures'] = {};
  for (const [kind, paths] of Object.entries(plan.fixtures) as Array<[FixtureKey, string[]]>) {
    const loaded: TileImage[] = [];
    for (const path of paths) {
      const img = await get(path);
      if (!img) continue;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      loaded.push({ img, w, h, square: w === h });
    }
    if (loaded.length > 0) fixtures[kind] = loaded;
  }

  if (
    Object.keys(images).length === 0 &&
    Object.keys(blobs).length === 0 &&
    Object.keys(decals).length === 0 &&
    Object.keys(fixtures).length === 0
  ) {
    throw new Error('none of the files listed in tiles.json were found in the folder');
  }

  return { name, tileSize: plan.tileSize, images, blobs, decals, fixtures, notes };
}

export async function loadTilesetFromFiles(files: FileList): Promise<Tileset> {
  const all = Array.from(files);
  const manifestFile = all.find((f) => relativePath(f).endsWith('tiles.json'));
  if (!manifestFile) throw new Error('no tiles.json in the selected folder');

  const plan = planTileset(parseJson(await manifestFile.text()));

  const byPath = new Map<string, File>();
  for (const f of all) byPath.set(relativePath(f), f);

  const rel =
    (manifestFile as File & { webkitRelativePath?: string }).webkitRelativePath || manifestFile.name;
  const folder = rel.includes('/') ? rel.split('/')[0] : 'tileset';

  return buildTileset(plan, byPath, folder);
}

/** Deterministic variant pick so the preview does not shimmer between redraws. */
export function variantFor(images: TileImage[], x: number, y: number): TileImage {
  return images[hashTile(x, y) % images.length];
}
