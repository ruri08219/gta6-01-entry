// Cars: box-built vehicle meshes and arcade driving physics with
// building collision, plus the enter/exit helper.
import * as THREE from 'three';
import { CAR_COLORS } from './config.js';

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : 0x223344 })
  );
  cabin.position.set(0, 1.35, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  // Headlights + taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), hl);
    h.position.set(sx, 0.65, 2.22);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    t.position.set(sx, 0.65, -2.22);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.85, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  return group;
}

export function randomCarColor(i) { return CAR_COLORS[i % CAR_COLORS.length]; }

// A drivable car: mesh + arcade state. Heading 0 = facing -Z.
export function createCar(mesh, x, z, heading) {
  const car = {
    mesh, x, z, heading: heading || 0,
    speed: 0, steer: 0,
    isPlayer: false, isPolice: false, isTraffic: false,
    topSpeed: 34, accel: 22, brake: 34,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = car.heading;
  return car;
}

function hitBuilding(x, z, colliders, pad) {
  for (const c of colliders) {
    if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return c;
  }
  return null;
}

// Arcade drive step. Returns true when a hard collision happened.
export function driveCar(car, input, dt, colliders) {
  const forward = input.forward ? 1 : 0;
  const reverse = input.back ? 1 : 0;
  if (forward) car.speed += car.accel * dt;
  else if (reverse) car.speed -= (car.speed > 0.5 ? car.brake : car.accel * 0.55) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
  car.speed = Math.max(-12, Math.min(car.topSpeed, car.speed));

  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += car.steer * 1.9 * dt * dir * Math.min(1, Math.abs(car.speed) / 8 + 0.25);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Note: heading 0 faces +Z in this layout; mesh is rotated to match.
  let crashed = false;
  if (hitBuilding(nx, nz, colliders, 1.4)) {
    // Try sliding along one axis.
    if (!hitBuilding(nx, car.z, colliders, 1.4)) { car.x = nx; }
    else if (!hitBuilding(car.x, nz, colliders, 1.4)) { car.z = nz; }
    else { crashed = true; }
    if (Math.abs(car.speed) > 12) crashed = true;
    car.speed *= 0.25;
  } else {
    car.x = nx; car.z = nz;
  }
  // Stay inside the playable area.
  car.x = Math.max(-170, Math.min(175, car.x));
  car.z = Math.max(-170, Math.min(170, car.z));

  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return crashed;
}

// Nearest car within range of a point, for stealing / entering.
export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
