// Traffic cars that loop the road grid and pedestrians strolling the
// sidewalks. Both are simple waypoint followers with wrap-around.
import * as THREE from 'three';
import { CITY, roadLines } from './config.js';
import { makeCarMesh, randomCarColor, createCar } from './cars.js';

export function spawnTraffic(scene, count) {
  const lines = roadLines();
  const cars = [];
  for (let i = 0; i < count; i++) {
    const mesh = makeCarMesh(randomCarColor(i * 3 + 1), false);
    scene.add(mesh);
    const car = createCar(mesh, 0, 0, 0);
    car.isTraffic = true;
    car.topSpeed = 10 + (i % 4) * 2;
    // Pick a road line and a direction; drive its full length, then U-turn.
    car.road = lines[i % lines.length];
    car.axis = i % 2 === 0 ? 'x' : 'z';
    car.dir = i % 3 === 0 ? -1 : 1;
    car.offset = (i * 37) % (CITY.half * 2) - CITY.half;
    car.speed = car.topSpeed;
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, playerCar) {
  const half = CITY.half;
  for (const c of cars) {
    c.offset += c.dir * c.speed * dt;
    if (c.offset > half) { c.offset = half; c.dir = -1; }
    if (c.offset < -half) { c.offset = -half; c.dir = 1; }
    // Simple give-way: slow down if the player car is right ahead.
    let target = c.topSpeed;
    if (playerCar) {
      const d = Math.hypot(playerCar.x - c.x, playerCar.z - c.z);
      if (d < 9) target = 0;
    }
    c.speed += (target - c.speed) * Math.min(1, dt * 2);
    if (c.axis === 'x') {
      c.x = c.offset; c.z = c.road;
      c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      c.x = c.road; c.z = c.offset;
      c.heading = c.dir > 0 ? 0 : Math.PI;
    }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    const spin = c.speed * dt * 2.4;
    for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
  }
}

function makePedMesh(shirtColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.4),
    new THREE.MeshLambertMaterial({ color: shirtColor })
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.7, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
  );
  legs.position.y = 0.35;
  group.add(legs);
  return group;
}

export function spawnPedestrians(scene, count) {
  const lines = roadLines();
  const shirts = [0xd43d2a, 0x2a6fd4, 0xf2c230, 0x34a853, 0xe8e8e8, 0x8e44ad, 0xff7f2a, 0x16a085];
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePedMesh(shirts[i % shirts.length]);
    scene.add(mesh);
    const line = lines[i % lines.length];
    peds.push({
      mesh,
      axis: i % 2 === 0 ? 'x' : 'z',
      road: line,
      side: (i % 4 < 2 ? 1 : -1) * (CITY.road / 2 + 2.2),
      along: (i * 53) % (CITY.half * 2) - CITY.half,
      dir: i % 3 === 0 ? -1 : 1,
      speed: 1.4 + (i % 5) * 0.35,
      bob: Math.random() * 6,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt) {
  const half = CITY.half;
  for (const p of peds) {
    p.along += p.dir * p.speed * dt;
    if (p.along > half) { p.along = half; p.dir = -1; }
    if (p.along < -half) { p.along = -half; p.dir = 1; }
    p.bob += dt * 7;
    const x = p.axis === 'x' ? p.along : p.road + p.side;
    const z = p.axis === 'x' ? p.road + p.side : p.along;
    p.mesh.position.set(x, Math.abs(Math.sin(p.bob)) * 0.08, z);
    p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
  }
}
