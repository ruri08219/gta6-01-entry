// Solara Bay city builder: sun-soaked grid city, marina beach, palm-lined
// roads, lit windows. Returns the colliders the player and cars use.
import * as THREE from 'three';
import { CITY, PALETTE, roadLines } from './config.js';

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function buildCity(scene) {
  const rand = seededRand(20261118);
  const colliders = [];
  const half = CITY.half;
  const pitch = CITY.pitch;

  // Sky, sun and light.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0x9fd0e8, 180, 520);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9));

  // Ground: grass base, then asphalt roads, sidewalks, sand beach + ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, half * 2 + 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const lines = roadLines();
  for (const c of lines) {
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, half * 2), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(c, 0.02, 0);
    roadV.receiveShadow = true;
    scene.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.road), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0.02, c);
    roadH.receiveShadow = true;
    scene.add(roadH);
    // Centre dashes.
    for (let t = -half + 6; t < half - 6; t += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 4), new THREE.MeshBasicMaterial({ color: 0xf2d13d }));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, t);
      scene.add(dash);
      const dash2 = dash.clone();
      dash2.position.set(t, 0.04, c);
      dash2.rotation.z = Math.PI / 2;
      scene.add(dash2);
    }
  }

  // Buildings: one or two per block, pastel towers with lit windows.
  const winLit = new THREE.MeshBasicMaterial({ color: PALETTE.windowLit });
  const winDark = new THREE.MeshBasicMaterial({ color: PALETTE.windowDark });
  const blockCentres = [];
  for (let i = 0; i < CITY.blocks; i++) {
    for (let j = 0; j < CITY.blocks; j++) {
      const cx = -half + CITY.road + CITY.block / 2 + i * pitch;
      const cz = -half + CITY.road + CITY.block / 2 + j * pitch;
      blockCentres.push([cx, cz]);
    }
  }
  for (const [cx, cz] of blockCentres) {
    const n = rand() < 0.45 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const w = 12 + rand() * 14;
      const d = 12 + rand() * 14;
      const h = 8 + rand() * rand() * 46;
      const ox = n === 2 ? (k === 0 ? -9 : 9) : 0;
      const oz = n === 2 ? (k === 0 ? -9 : 9) : 0;
      const color = PALETTE.building[Math.floor(rand() * PALETTE.building.length)];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color })
      );
      mesh.position.set(cx + ox, h / 2, cz + oz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      colliders.push({
        minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
        minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
      });
      // Window strips on the street-facing sides.
      const floors = Math.max(1, Math.floor(h / 5));
      for (let f = 0; f < floors; f++) {
        for (let wx = -w / 2 + 3; wx < w / 2 - 2; wx += 5) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(2.4, 2.6),
            rand() < 0.45 ? winLit : winDark
          );
          win.position.set(cx + ox + wx, 3.5 + f * 5, cz + oz + d / 2 + 0.06);
          scene.add(win);
        }
      }
      // Rooftop box (AC unit / sign).
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.6, 3),
        new THREE.MeshLambertMaterial({ color: 0x555c66 })
      );
      roof.position.set(cx + ox, h + 0.8, cz + oz);
      scene.add(roof);
    }
  }

  // Landmark: Bay Bank tower at (58, 58) and the hideout shack at (-95, -95).
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(20, 34, 16),
    new THREE.MeshLambertMaterial({ color: 0xd8c98a })
  );
  bank.position.set(58, 17, 58);
  bank.castShadow = true;
  scene.add(bank);
  colliders.push({ minX: 48, maxX: 68, minZ: 50, maxZ: 66 });

  // Palm trees along the roads.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e4f });
  for (let i = 0; i < 46; i++) {
    const line = lines[Math.floor(rand() * lines.length)];
    const along = (rand() * 2 - 1) * (half - 8);
    const side = rand() < 0.5 ? -1 : 1;
    const x = rand() < 0.5 ? line + side * (CITY.road / 2 + 2.5) : along;
    const z = rand() < 0.5 ? along : line + side * (CITY.road / 2 + 2.5);
    if (Math.abs(x) > half + 4 || Math.abs(z) > half + 4) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    crown.position.set(x, 8.2, z);
    crown.castShadow = true;
    scene.add(crown);
  }

  // Beach + ocean on the east edge (marina side).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, half * 2 + 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(half + 35, 0.03, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, half * 2 + 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(half + 180, 0.01, 0);
  scene.add(sea);
  // Marina pier.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(46, 1, 10),
    new THREE.MeshLambertMaterial({ color: 0x9a7b52 })
  );
  pier.position.set(half + 90, 0.6, 0);
  pier.castShadow = true;
  scene.add(pier);

  return { colliders, half, lines };
}

// A glowing vertical beacon + ground ring marking a mission target.
export function makeBeacon(scene, color) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  beam.position.y = 30;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.6, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  scene.add(group);
  return group;
}
