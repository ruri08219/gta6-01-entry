// Combat: hostile enforcers who chase the player and can be shot.
// A tracer line shows each shot; hits flash the target.
import * as THREE from 'three';

function makeThugMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.2, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x8a1f1f })
  );
  body.position.y = 1.1;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a070 })
  );
  head.position.y = 1.95;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.75, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
  );
  legs.position.y = 0.38;
  group.add(legs);
  return group;
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.tracers = [];
    this.cooldown = 0;
  }

  spawnSquad(x, z, count, label) {
    const made = [];
    for (let i = 0; i < count; i++) {
      const mesh = makeThugMesh();
      mesh.position.set(x + (Math.random() * 2 - 1) * 8, 0, z + (Math.random() * 2 - 1) * 8);
      this.scene.add(mesh);
      const e = { mesh, x: mesh.position.x, z: mesh.position.z, health: 3, speed: 3.4 + Math.random(), label };
      this.enemies.push(e);
      made.push(e);
    }
    return made;
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  enemyCount() { return this.enemies.length; }

  // Hitscan shot from the player toward the camera aim. Returns enemies hit.
  shoot(playerPos, aimDir) {
    if (this.cooldown > 0) return null;
    this.cooldown = 0.28;
    let best = null, bestD = 60;
    for (const e of this.enemies) {
      const dx = e.x - playerPos.x, dz = e.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > 60 || d > bestD) continue;
      const dot = (dx * aimDir.x + dz * aimDir.z) / (d || 1);
      if (dot > 0.86) { best = e; bestD = d; }
    }
    // Tracer from player to hit point or max range.
    const endX = playerPos.x + aimDir.x * (best ? bestD : 55);
    const endZ = playerPos.z + aimDir.z * (best ? bestD : 55);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(playerPos.x, 1.4, playerPos.z),
      new THREE.Vector3(endX, 1.4, endZ),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
    if (best) {
      best.health -= 1;
      best.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xffffff });
      setTimeout(() => {
        best.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
      }, 90);
      if (best.health <= 0) {
        this.scene.remove(best.mesh);
        this.enemies.splice(this.enemies.indexOf(best), 1);
        return best;
      }
    }
    return null;
  }

  update(dt, playerPos, onTouch) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) { this.scene.remove(t.line); return false; }
      return true;
    });
    for (const e of this.enemies) {
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      e.x += (dx / d) * e.speed * dt;
      e.z += (dz / d) * e.speed * dt;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (d < 1.6) onTouch(e);
    }
  }
}
