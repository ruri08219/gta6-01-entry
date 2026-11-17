// The city of Vice Shores: a road grid, the buildings that fill its blocks, the
// beach and harbour on the east edge, the park, and the named places missions use.
// Everything is placed from the seeded generator, so the same seed builds the
// same city. Buildings never sit on a road, the beach or the park.

import { BEACH_X, PARK, ROADS_H, ROADS_V, ROAD_W, WORLD } from './config.js';

export const PLACES = {
  marlaOffice: { x: 540, y: 560, label: "Marla's Office" },
  dropPoint: { x: 2640, y: 480, label: 'Drop Point' },
  pier: { x: 2980, y: 900, label: 'Old Pier' },
  parkCash: { x: 1460, y: 1390, label: 'Park Bench' },
  safehouse: { x: 540, y: 1780, label: 'Safehouse' },
  courierStart: { x: 1200, y: 720, label: 'Courier Route' },
  diner: { x: 980, y: 900, label: 'Sunset Diner' },
};

function blockOverlapsPark(x, y, w, h) {
  return x < PARK.x + PARK.w && x + w > PARK.x && y < PARK.y + PARK.h && y + h > PARK.y;
}

export function generateCity(rng) {
  const buildings = [];
  const roofColors = ['#6b5a4e', '#55627a', '#7a5a68', '#5d6b52', '#715f43'];
  // Blocks start well past the road edge, so the sidewalk between the road and
  // the first wall is wide enough to walk and to park a car on.
  const edge = ROAD_W / 2 + 34;
  // No building may cover a mission spot or a cash pickup (with room to stand).
  const clearSpots = [
    ...Object.values(PLACES),
    { x: 1200, y: 560 },
    { x: 2080, y: 1560 },
  ];

  for (let vi = 0; vi < ROADS_V.length; vi += 1) {
    const x0 = ROADS_V[vi] + edge;
    const x1 = vi + 1 < ROADS_V.length ? ROADS_V[vi + 1] - edge : BEACH_X - 40;
    if (x1 - x0 < 90) continue;
    for (let hi = 0; hi < ROADS_H.length; hi += 1) {
      const y0 = ROADS_H[hi] + edge;
      const y1 = hi + 1 < ROADS_H.length ? ROADS_H[hi + 1] - edge : WORLD.height - 60;
      if (y1 - y0 < 90) continue;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (blockOverlapsPark(x0, y0, bw, bh)) continue;
      // One or two buildings per block, with a gap between them.
      const split = rng.chance(0.55) && bw > 260 && bh > 200;
      const spots = split
        ? [
            { x: x0, y: y0, w: bw * 0.46, h: bh * 0.9 },
            { x: x0 + bw * 0.54, y: y0 + bh * 0.1, w: bw * 0.46, h: bh * 0.9 },
          ]
        : [{ x: x0 + bw * 0.08, y: y0 + bh * 0.08, w: bw * 0.84, h: bh * 0.84 }];
      for (const s of spots) {
        // Keep mission spots and cash pickups in the open, never under a roof.
        const coversSpot = clearSpots.some((spot) => (
          spot.x > s.x - 48 && spot.x < s.x + s.w + 48
          && spot.y > s.y - 48 && spot.y < s.y + s.h + 48
        ));
        if (coversSpot) continue;
        const height = rng.int(1, 4);
        buildings.push({
          x: Math.round(s.x),
          y: Math.round(s.y),
          w: Math.round(s.w),
          h: Math.round(s.h),
          floors: height,
          color: rng.pick(roofColors),
          litSeed: rng.int(0, 100000),
        });
      }
    }
  }

  // Parking spots: a few cars parked along the kerb of each avenue, just off the
  // traffic lane and clear of the buildings' collision margin.
  const parking = [];
  for (const rx of ROADS_V) {
    for (const ry of ROADS_H) {
      if (rng.chance(0.5)) {
        parking.push({ x: rx + ROAD_W / 2 + 2, y: ry + 150, angle: Math.PI / 2 });
      }
      if (rng.chance(0.4)) {
        parking.push({ x: rx - ROAD_W / 2 - 2, y: ry + 320, angle: -Math.PI / 2 });
      }
    }
  }

  // Trees in the park, fixed by the same stream.
  const trees = [];
  for (let i = 0; i < 26; i += 1) {
    trees.push({
      x: PARK.x + 24 + rng.range(0, PARK.w - 48),
      y: PARK.y + 24 + rng.range(0, PARK.h - 48),
      r: rng.range(9, 15),
    });
  }

  return { buildings, parking, trees, places: PLACES };
}

/** True when the point is inside a building (walls block feet and wheels). */
export function hitsBuilding(city, x, y, margin) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

/** True when the point is on a road (cars may drive here, peds may not stroll). */
export function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

/** Nearest road centre to a point, used by traffic and the police. */
export function nearestRoad(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestDist) { bestDist = d; best = { axis: 'v', at: rx, along: y }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestDist) { bestDist = d; best = { axis: 'h', at: ry, along: x }; }
  }
  return best;
}
