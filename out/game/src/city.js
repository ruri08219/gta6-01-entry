// Vice Shores, the fictional city: a road grid, building blocks, a park, a beach
// strip and the sea on the east edge. Everything is placed from the seed, so the
// same seed always builds the same streets.
import { createRng } from './rng.js';

export const TILE = 48;
export const GRID = 48;
export const WORLD = TILE * GRID; // 2304 px square
export const ROAD_EVERY = 7;
export const BEACH_X = 44; // tiles: sand starts here
export const SEA_X = 46; // tiles: water starts here

const ROOF_COLORS = [
  '#e2703a', '#d95f4b', '#c94f6d', '#7d6bb0', '#4f8f7b',
  '#b08954', '#5b7fa6', '#a66a8f', '#8a9a5b', '#c97b4a',
  '#6d5a8f', '#4a7d8c',
];
const WALL_COLORS = ['#f2e3c6', '#e8d3b0', '#d9c2a3', '#f5ead6', '#e3cfae'];

export function isRoadTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) return false;
  if (tx >= SEA_X) return false;
  return tx % ROAD_EVERY === 0 || ty % ROAD_EVERY === 0;
}

export function isSeaTile(tx, ty) {
  return tx >= SEA_X && tx < GRID && ty >= 0 && ty < GRID;
}

export function isBeachTile(tx, ty) {
  return tx >= BEACH_X && tx < SEA_X && ty >= 0 && ty < GRID;
}

// Nearest road tile to a pixel point (used by cop cars to rejoin the streets).
export function nearestRoadTile(px, py) {
  const tx = Math.max(0, Math.min(GRID - 1, Math.floor(px / TILE)));
  const ty = Math.max(0, Math.min(GRID - 1, Math.floor(py / TILE)));
  let best = { tx, ty };
  let bestD = Infinity;
  for (let x = 0; x < GRID; x += 1) {
    for (let y = 0; y < GRID; y += 1) {
      if (!isRoadTile(x, y)) continue;
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d < bestD) {
        bestD = d;
        best = { tx: x, ty: y };
      }
    }
  }
  return best;
}

export function buildCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // One park block and one plaza block, fixed by grid position.
  const parkBlock = { bx: 2, by: 2 };
  const plazaBlock = { bx: 4, by: 1 };

  for (let bx = 0; bx < 6; bx += 1) {
    for (let by = 0; by < 6; by += 1) {
      const x0 = (bx * ROAD_EVERY + 1) * TILE;
      const y0 = (by * ROAD_EVERY + 1) * TILE;
      const x1 = (bx * ROAD_EVERY + 6) * TILE;
      const y1 = (by * ROAD_EVERY + 6) * TILE;
      if (x0 >= BEACH_X * TILE) continue;
      if (bx === parkBlock.bx && by === parkBlock.by) {
        for (let i = 0; i < 14; i += 1) {
          trees.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            r: rng.range(9, 15),
          });
        }
        continue;
      }
      if (bx === plazaBlock.bx && by === plazaBlock.by) {
        for (let i = 0; i < 6; i += 1) {
          trees.push({
            x: rng.range(x0 + 24, x1 - 24),
            y: rng.range(y0 + 24, y1 - 24),
            r: rng.range(8, 12),
          });
        }
        continue;
      }
      // Split each block into one or two buildings with a courtyard gap.
      const split = rng.next() < 0.5;
      const spots = split
        ? [
          { x: x0 + 8, y: y0 + 8, w: (x1 - x0) / 2 - 16, h: y1 - y0 - 16 },
          { x: x0 + (x1 - x0) / 2 + 8, y: y0 + 8, w: (x1 - x0) / 2 - 16, h: y1 - y0 - 16 },
        ]
        : [{ x: x0 + 10, y: y0 + 10, w: x1 - x0 - 20, h: y1 - y0 - 20 }];
      for (const s of spots) {
        buildings.push({
          x: s.x, y: s.y, w: s.w, h: s.h,
          roof: rng.pick(ROOF_COLORS),
          wall: rng.pick(WALL_COLORS),
          floors: rng.int(1, 4),
        });
      }
      if (rng.next() < 0.6) {
        trees.push({ x: x0 + 14, y: y0 + 14, r: 9 });
        trees.push({ x: x1 - 14, y: y1 - 14, r: 9 });
      }
    }
  }

  // Beach umbrellas and palms along the sand.
  for (let i = 0; i < 10; i += 1) {
    trees.push({
      x: (BEACH_X + 0.5) * TILE + rng.range(-8, 8),
      y: rng.range(2, GRID - 2) * TILE,
      r: 11, palm: true,
    });
  }

  // Street lamps at road crossings.
  for (let x = 0; x < GRID; x += ROAD_EVERY) {
    for (let y = 0; y < GRID; y += ROAD_EVERY) {
      lamps.push({ x: x * TILE + TILE - 6, y: y * TILE + 6 });
    }
  }

  // Fixed landmarks the missions use.
  const safehouse = { x: 1.5 * TILE, y: 1.5 * TILE, label: 'Hideout' };
  const garage = { x: 5.5 * TILE, y: 35.5 * TILE, label: 'Garage' };
  const pier = { x: (BEACH_X + 0.7) * TILE, y: 21.5 * TILE, label: 'Pier' };
  const market = { x: 28.5 * TILE, y: 7.5 * TILE, label: 'Market' };
  const docks = { x: 14.5 * TILE, y: 42.5 * TILE, label: 'Docks' };

  return {
    buildings, trees, lamps,
    park: { x: (parkBlock.bx * ROAD_EVERY + 3.5) * TILE, y: (parkBlock.by * ROAD_EVERY + 3.5) * TILE },
    safehouse, garage, pier, market, docks,
    spawn: { x: 1.5 * TILE, y: 3.5 * TILE },
  };
}

// Circle (px, py, radius) against every building; true when it overlaps one.
export function hitsBuilding(city, px, py, radius) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

// True when a circle is on drivable/walkable ground (not sea, not inside a building).
export function walkable(city, px, py, radius) {
  if (px < radius || py < radius || px > WORLD - radius || py > WORLD - radius) return false;
  if (px >= SEA_X * TILE) return false;
  return hitsBuilding(city, px, py, radius) === null;
}
