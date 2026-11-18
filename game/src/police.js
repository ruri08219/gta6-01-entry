// Wanted level and Bay PD pursuit cars. Wanted rises with crimes and
// cools off when the player stays clean and out of sight.
import * as THREE from 'three';
import { makeCarMesh, createCar } from './cars.js';

export class WantedSystem {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.level = 0;           // 0..5 stars
    this.heat = 0;            // 0..100 within the current level
    this.quietTime = 0;
    this.police = [];
    this.sirenPhase = 0;
  }

  addHeat(amount, reason) {
    if (this.level >= 5) return;
    this.heat += amount;
    this.quietTime = 0;
    if (this.heat >= 100) {
      this.heat = 0;
      this.level = Math.min(5, this.level + 1);
    }
    this.syncPolice();
  }

  setLevel(level) {
    this.level = Math.max(0, Math.min(5, level));
    this.heat = 0;
    this.quietTime = 0;
    this.syncPolice();
  }

  syncPolice() {
    const want = Math.min(4, this.level);
    while (this.police.length < want) {
      const mesh = makeCarMesh(0x111111, true);
      this.scene.add(mesh);
      const car = createCar(mesh, 0, 0, 0);
      car.isPolice = true;
      car.topSpeed = 30 + this.level * 2;
      this.police.push(car);
    }
    while (this.police.length > want) {
      const car = this.police.pop();
      this.scene.remove(car.mesh);
    }
    // Spread fresh police cars on roads near the player.
    for (const car of this.police) {
      if (!car.placed) {
        car.x = (Math.random() * 2 - 1) * 60;
        car.z = (Math.random() * 2 - 1) * 60;
        car.placed = true;
      }
    }
  }

  update(dt, player, playerCar, onRam) {
    // Cool off: no crime for a while and no police close by.
    if (this.level > 0) {
      this.quietTime += dt;
      let nearest = 999;
      for (const p of this.police) nearest = Math.min(nearest, Math.hypot(p.x - player.pos.x, p.z - player.pos.z));
      if (this.quietTime > 22 && nearest > 55) {
        this.level -= 1;
        this.heat = 0;
        this.quietTime = 0;
        this.syncPolice();
      }
    }
    this.sirenPhase += dt;
    for (const p of this.police) {
      // Pursuit steering: aim at the player, ram on contact.
      const tx = playerCar ? playerCar.x : player.pos.x;
      const tz = playerCar ? playerCar.z : player.pos.z;
      const dx = tx - p.x, dz = tz - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      p.speed += ((dist > 6 ? p.topSpeed : 6) - p.speed) * Math.min(1, dt * 1.5);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const spin = p.speed * dt * 2.4;
      for (const w of p.mesh.userData.wheels) w.rotation.x += spin;
      // Flashing light bar.
      if (p.mesh.userData.lightBar) {
        p.mesh.userData.lightBar.material.color.setHex(
          Math.sin(this.sirenPhase * 10) > 0 ? 0xff2222 : 0x2244ff
        );
      }
      if (dist < 3.4) onRam(p);
    }
  }
}
