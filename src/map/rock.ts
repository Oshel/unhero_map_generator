import type { Layers, Size } from '../types/prefab';
import type { Rng } from '../core/rng';
import type { PlacedRoom } from './types';

/**
 * Chew an irregular edge into the rock the dungeon is cut from.
 *
 * Rooms tile the map edge to edge, so the composed map comes out as a perfect
 * rectangle with a wall running all the way round it - a dungeon in a box. The
 * rock is meant to read as rock, so the outside of it is eaten away at random
 * until the silhouette is ragged.
 *
 * Nothing that holds a room up is ever touched: a wall tile with anything
 * walkable, watery or diggable within one tile of it stays put, so every room
 * keeps a sealed shell and only surplus rock behind it can go.
 */

/** How many bites are taken, and how eager each one is. Later bites taper. */
const PASSES = [0.75, 0.6, 0.5, 0.4, 0.3, 0.22] as const;

function isNothing(layers: Layers, x: number, y: number): boolean {
  return layers.blocking[y][x] === 'void' && layers.ground[y][x] === 'void';
}

function clear(layers: Layers, x: number, y: number): void {
  layers.ground[y][x] = 'void';
  layers.blocking[y][x] = 'void';
  layers.deco[y][x] = 'void';
  layers.overlay[y][x] = 'void';
}

/** Anything a room is made of - floor, a pond, a pit, an obstacle, a door. */
function isSomething(layers: Layers, x: number, y: number): boolean {
  return layers.blocking[y][x] !== 'wall' && !isNothing(layers, x, y);
}

/** Rock left standing on its own in the void: rubble, not silhouette. */
function clearSpecks(layers: Layers, size: Size): void {
  for (let pass = 0; pass < 3; pass++) {
    const doomed: Array<[number, number]> = [];
    for (let y = 0; y < size.h; y++) {
      for (let x = 0; x < size.w; x++) {
        if (layers.blocking[y][x] !== 'wall') continue;
        let neighbours = 0;
        let holdsSomethingUp = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size.w || ny >= size.h) continue;
            if (isSomething(layers, nx, ny)) holdsSomethingUp = true;
            if (layers.blocking[ny][nx] === 'wall') neighbours++;
          }
        }
        if (!holdsSomethingUp && neighbours < 2) doomed.push([x, y]);
      }
    }
    if (doomed.length === 0) return;
    for (const [x, y] of doomed) clear(layers, x, y);
  }
}

export function erodeOuterRock(layers: Layers, size: Size, rng: Rng): void {
  for (const chance of PASSES) {
    const doomed: Array<[number, number]> = [];
    for (let y = 0; y < size.h; y++) {
      for (let x = 0; x < size.w; x++) {
        if (layers.blocking[y][x] !== 'wall') continue;

        // Only rock the outside can get at: on the map edge, or already beside
        // a bite taken out of it.
        let exposed = x === 0 || y === 0 || x === size.w - 1 || y === size.h - 1;
        let holdsSomethingUp = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size.w || ny >= size.h) continue;
            if (isSomething(layers, nx, ny)) holdsSomethingUp = true;
            // Diagonal neighbours count as exposure too, or the edge comes out
            // as a staircase rather than as broken rock.
            if (isNothing(layers, nx, ny)) exposed = true;
          }
        }
        if (!exposed || holdsSomethingUp) continue;
        if (rng.chance(chance)) doomed.push([x, y]);
      }
    }
    if (doomed.length === 0) break;
    for (const [x, y] of doomed) clear(layers, x, y);
  }
  clearSpecks(layers, size);
}

/**
 * The rooms carry their own copy of the tiles and that copy is what gets
 * exported, so whatever the erosion took off the map has to come off them too.
 */
export function syncRoomsToMap(rooms: PlacedRoom[], layers: Layers, size: Size): void {
  for (const room of rooms) {
    for (let y = 0; y < room.doc.size.h; y++) {
      for (let x = 0; x < room.doc.size.w; x++) {
        const mx = room.x + x;
        const my = room.y + y;
        if (mx < 0 || my < 0 || mx >= size.w || my >= size.h) continue;
        room.doc.layers.ground[y][x] = layers.ground[my][mx];
        room.doc.layers.blocking[y][x] = layers.blocking[my][mx];
        room.doc.layers.deco[y][x] = layers.deco[my][mx];
        room.doc.layers.overlay[y][x] = layers.overlay[my][mx];
      }
    }
  }
}
