// Vice Shores simulation: one fixed-step update for the player (on foot or in a
// car), traffic that follows the road grid, pedestrians on the sidewalks, police
// that answer the wanted level, five story missions, combat and saving.
// The world is deterministic from its seed: the same seed and the same inputs
// always replay the same city, traffic and missions.

import {
  BEACH_X, CAR, CLOCK, PARK, PED, PLAYER, POLICE, ROADS_H, ROADS_V, ROAD_W,
  SAVE_KEY, STEP, WANTED_MAX, WORLD,
} from './config.js';
import { generateCity, hitsBuilding, nearestRoad, onRoad } from './city.js';

export const EVENT_MISSION = 1;
export const EVENT_GAMEOVER = 2;
export const EVENT_WANTED_UP = 4;

export const MISSIONS = [
  {
    title: '1 · The Package',
    intro: 'Marla Vane: "Rook, take this package to the drop point by the marina. No detours."',
    objective: 'Reach the drop point',
    reward: 150,
  },
  {
    title: '2 · The Pier Meet',
    intro: 'Marla Vane: "A contact waits at the old pier. Hear what he knows, then walk away."',
    objective: 'Meet the contact at the pier',
    reward: 200,
  },
  {
    title: '3 · Park Cash',
    intro: 'Marla Vane: "Cash is stashed by the park bench. Grab it, then pay the diner tab."',
    objective: 'Collect the stash, then reach the diner',
    reward: 300,
  },
  {
    title: '4 · Tail the Courier',
    intro: 'Marla Vane: "A courier is running our route. Stay on his tail — close, not seen."',
    objective: 'Stay close to the courier',
    reward: 400,
  },
  {
    title: '5 · Lose the Heat',
    intro: 'Marla Vane: "The whole force is on you. Shake them, then get to the safehouse."',
    objective: 'Lose the cops, then reach the safehouse',
    reward: 500,
  },
];

const CAR_COLORS = ['#c9ced6', '#f2c230', '#7fb069', '#c77dff', '#e07a5f', '#8ecae6', '#e9c46a'];
const PED_SHIRTS = ['#7a86c9', '#c96a7a', '#6aa87a', '#c9a86a', '#8a6ac9', '#5fb8a6'];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(angle, target, rate, dt) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = clamp(diff, -rate * dt, rate * dt);
  return angle + step;
}

export function createWorld(rng) {
  const city = generateCity(rng);
  const state = {
    rng,
    city,
    time: 0,
    clockMinutes: CLOCK.startHour * 60,
    cash: 0,
    wanted: 0,
    crimeTimer: 0,
    decayTimer: 0,
    missionIndex: 0,
    missionStage: 0,
    missionProgress: 0,
    missionDone: false,
    storyComplete: false,
    banner: '',
    bannerTimer: 0,
    toast: '',
    toastTimer: 0,
    gameOver: false,
    stats: { carsStolen: 0, hits: 0, missionsDone: 0 },
    player: {
      x: 760, y: 640, angle: 0, health: PLAYER.health,
      inCar: null, attackCd: 0, invuln: 0, moving: false,
    },
    cars: [],
    peds: [],
    pickups: [],
    nextCarId: 1,
  };

  function addCar(car) {
    car.id = state.nextCarId;
    state.nextCarId += 1;
    state.cars.push(car);
    return car;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const vertical = rng.chance(0.5);
      const road = vertical ? rng.pick(ROADS_V) : rng.pick(ROADS_H);
      const along = rng.range(120, (vertical ? WORLD.height : WORLD.width) - 120);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 4);
      addCar({
        kind: 'traffic',
        x: vertical ? road + lane : along,
        y: vertical ? along : road + lane,
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        speed: CAR.trafficSpeed + rng.range(-CAR.trafficSpeedJitter, CAR.trafficSpeedJitter),
        dir,
        axis: vertical ? 'v' : 'h',
        road,
        color: rng.pick(CAR_COLORS),
        stolen: false,
        parked: false,
      });
    }
  }

  function spawnParked() {
    for (const spot of city.parking) {
      addCar({
        kind: 'parked', x: spot.x, y: spot.y, angle: spot.angle, speed: 0,
        dir: 1, axis: 'v', road: spot.x, color: rng.pick(CAR_COLORS),
        stolen: false, parked: true,
      });
    }
  }

  function spawnPed(x, y, kind) {
    const ped = {
      kind: kind ?? 'ped',
      x, y, angle: rng.range(0, Math.PI * 2),
      speed: PED.speed + rng.range(-PED.speedJitter, PED.speedJitter),
      targetX: x, targetY: y,
      shirt: kind === 'cop' ? '#1d2f7a' : rng.pick(PED_SHIRTS),
      down: 0, attackCd: 0, wanderTimer: 0,
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const road = rng.pick(ROADS_V);
      const street = rng.pick(ROADS_H);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = rng.chance(0.5)
        ? road + side * (ROAD_W / 2 + 14) : rng.range(200, WORLD.width - 200);
      const y = rng.chance(0.5)
        ? street + side * (ROAD_W / 2 + 14) : rng.range(200, WORLD.height - 200);
      spawnPed(clamp(x, 60, WORLD.width - 60), clamp(y, 60, WORLD.height - 60));
    }
  }

  function reset() {
    state.time = 0;
    state.clockMinutes = CLOCK.startHour * 60;
    state.cash = 0;
    state.wanted = 0;
    state.crimeTimer = 0;
    state.decayTimer = 0;
    state.missionIndex = 0;
    state.missionStage = 0;
    state.missionProgress = 0;
    state.missionDone = false;
    state.storyComplete = false;
    state.banner = '';
    state.bannerTimer = 0;
    state.toast = '';
    state.toastTimer = 0;
    state.gameOver = false;
    state.stats = { carsStolen: 0, hits: 0, missionsDone: 0 };
    state.player = {
      // Spawn on the avenue itself, clear of every building: free movement in all directions.
      x: 760, y: 640, angle: 0, health: PLAYER.health,
      inCar: null, attackCd: 0, invuln: 0, moving: false,
    };
    state.cars = [];
    state.peds = [];
    state.pickups = [];
    state.nextCarId = 1;
    spawnTraffic(16);
    spawnParked();
    spawnPeds(22);
    startMission(0);
    state.missionTarget = missionTarget();
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash, missionIndex: state.missionIndex, missionsDone: state.stats.missionsDone,
      }));
    } catch { /* storage off: progress lasts this visit only */ }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.cash !== 'number' || typeof parsed.missionIndex !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function applySave(saved) {
    state.cash = Math.max(0, Math.floor(saved.cash));
    state.stats.missionsDone = Math.max(0, Math.floor(saved.missionsDone ?? 0));
    const next = Math.floor(saved.missionIndex);
    if (next >= MISSIONS.length) {
      // Every mission done: resume in free roam, not by replaying the last one.
      state.missionIndex = MISSIONS.length;
      state.storyComplete = true;
      showBanner('Story complete — Vice Shores is yours, Rook. Free roam!', 6);
      state.missionTarget = null;
      return;
    }
    state.missionIndex = clamp(next, 0, MISSIONS.length - 1);
    startMission(state.missionIndex);
    state.missionTarget = missionTarget();
  }

  function showBanner(text, seconds) {
    state.banner = text;
    state.bannerTimer = seconds;
  }

  function showToast(text, seconds) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  function missionTarget() {
    const p = state.city.places;
    const i = state.missionIndex;
    if (i === 0) return { x: p.dropPoint.x, y: p.dropPoint.y, label: p.dropPoint.label };
    if (i === 1) return { x: p.pier.x, y: p.pier.y, label: p.pier.label };
    if (i === 2) return state.missionStage === 0
      ? { x: p.parkCash.x, y: p.parkCash.y, label: p.parkCash.label }
      : { x: p.diner.x, y: p.diner.y, label: p.diner.label };
    if (i === 3) {
      const courier = state.cars.find((c) => c.kind === 'courier');
      return courier ? { x: courier.x, y: courier.y, label: 'Courier' } : null;
    }
    if (i === 4) return { x: p.safehouse.x, y: p.safehouse.y, label: p.safehouse.label };
    return null;
  }

  function startMission(index) {
    state.missionIndex = index;
    state.missionStage = 0;
    state.missionProgress = 0;
    if (index >= MISSIONS.length) {
      state.storyComplete = true;
      showBanner('Story complete — Vice Shores is yours, Rook. Free roam!', 6);
      return;
    }
    const m = MISSIONS[index];
    showBanner(`${m.title} — ${m.intro}`, 7);
    if (index === 3) {
      // The courier drives a loop around the middle avenues.
      addCar({
        kind: 'courier',
        x: city.places.courierStart.x, y: city.places.courierStart.y,
        angle: 0, speed: 170, dir: 1, axis: 'h', road: ROADS_H[1],
        color: '#e9c46a', stolen: false, parked: false,
      });
    }
    if (index === 4) {
      state.wanted = 3;
      state.crimeTimer = 0;
      showToast('Wanted level 3! Lose the cops first.', 4);
    }
  }

  function completeMission(audio) {
    const m = MISSIONS[state.missionIndex];
    state.cash += m.reward;
    state.stats.missionsDone += 1;
    audio.cash();
    showBanner(`Mission complete: ${m.title} — +$${m.reward}`, 4);
    state.missionIndex += 1;
    state.missionStage = 0;
    state.missionProgress = 0;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyComplete = true;
      showBanner('Story complete — Vice Shores is yours, Rook. Free roam!', 6);
    } else {
      startMission(state.missionIndex);
    }
    // Save after the index moved, so a resumed game continues at the next mission.
    saveGame();
  }

  function addWanted(n, audio) {
    if (state.wanted >= WANTED_MAX) return;
    const before = state.wanted;
    state.wanted = Math.min(WANTED_MAX, state.wanted + n);
    state.crimeTimer = 0;
    state.decayTimer = 0;
    if (state.wanted > before) {
      audio.siren();
      showToast(`Wanted level ${state.wanted} — the police are coming.`, 3);
    }
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function policeNearby(x, y, radius) {
    for (const ped of state.peds) {
      if (ped.kind === 'cop' && ped.down <= 0 && dist(x, y, ped.x, ped.y) < radius) return true;
    }
    for (const car of state.cars) {
      if (car.kind === 'police' && dist(x, y, car.x, car.y) < radius) return true;
    }
    return false;
  }

  function stepPlayer(dt, controls, audio) {
    const p = state.player;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    const car = p.inCar !== null ? state.cars.find((c) => c.id === p.inCar) : null;

    if (controls.enter) {
      if (car) {
        // Step out beside the car.
        const side = p.angle + Math.PI / 2;
        p.x = car.x + Math.cos(side) * 34;
        p.y = car.y + Math.sin(side) * 34;
        p.angle = car.angle;
        p.inCar = null;
        car.parked = true;
        audio.click();
      } else {
        const target = nearestCar(p.x, p.y, 78, ['parked', 'traffic', 'police', 'courier', 'player']);
        if (target) {
          const wasTraffic = target.kind === 'traffic' || target.kind === 'courier';
          const wasPolice = target.kind === 'police';
          if (wasTraffic) {
            // Jacking a moving car: its driver spills out on foot.
            spawnPed(target.x + 30, target.y + 30, 'ped');
            state.stats.carsStolen += 1;
            if (policeNearby(p.x, p.y, 520)) addWanted(1, audio);
          }
          if (wasPolice) {
            state.stats.carsStolen += 1;
            addWanted(2, audio);
          }
          target.kind = 'player';
          target.parked = false;
          target.speed = 0;
          p.inCar = target.id;
          p.x = target.x;
          p.y = target.y;
          audio.engine();
        }
      }
    }

    if (car) {
      // Driving: W/S accelerate and brake, A/D steer (reversed when reversing).
      const forward = controls.up ? 1 : controls.down ? -1 : 0;
      if (forward > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
      else if (forward < 0) {
        car.speed = car.speed > 20 ? car.speed - CAR.brake * dt : Math.max(-CAR.maxReverse, car.speed - CAR.accel * 0.5 * dt);
      } else {
        car.speed *= Math.pow(0.4, dt);
        if (Math.abs(car.speed) < 4) car.speed = 0;
      }
      const steer = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
      if (steer !== 0 && Math.abs(car.speed) > 8) {
        car.angle += steer * CAR.turnRate * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!hitsBuilding(state.city, nx, ny, 16) && nx > 40 && nx < WORLD.width - 40 && ny > 40 && ny < WORLD.height - 40) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= -0.25;
        if (Math.abs(car.speed) > 120) { audio.hit(); }
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.moving = Math.abs(car.speed) > 20;
      if (Math.abs(car.speed) > 240 && state.time - (car.lastEngine ?? -1) > 0.9) {
        car.lastEngine = state.time;
        audio.engine();
      }
      // Running over a pedestrian while driving.
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 40) {
          ped.down = 4;
          state.stats.hits += 1;
          audio.hit();
          addWanted(1, audio);
          showToast('You ran someone over!', 2.5);
        }
      }
      return;
    }

    // On foot: WASD, Shift to run.
    const speed = controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = controls.mx;
    const my = controls.my;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      if (!hitsBuilding(state.city, nx, p.y, PLAYER.radius)) p.x = clamp(nx, 30, WORLD.width - 30);
      if (!hitsBuilding(state.city, p.x, ny, PLAYER.radius)) p.y = clamp(ny, 30, WORLD.height - 30);
    }

    if (controls.attack && p.attackCd <= 0) {
      p.attackCd = PLAYER.attackCooldown;
      audio.punch();
      let hitAnyone = false;
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d > PLAYER.attackRange + 12) continue;
        const facing = Math.abs(((angleTo(p.x, p.y, ped.x, ped.y) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (facing > 1.2) continue;
        ped.down = ped.kind === 'cop' ? 5 : 6;
        hitAnyone = true;
        state.stats.hits += 1;
        if (ped.kind === 'cop') addWanted(1, audio);
        else if (policeNearby(p.x, p.y, 520)) addWanted(1, audio);
      }
      if (hitAnyone) audio.hit();
    }
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' && car.kind !== 'courier' && car.kind !== 'taxi') continue;
      const speed = car.kind === 'courier' ? 170 : car.speed;
      let nx = car.x;
      let ny = car.y;
      if (car.axis === 'v') ny += car.dir * speed * dt;
      else nx += car.dir * speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const crossings = car.axis === 'v' ? ROADS_H : ROADS_V;
      for (const cross of crossings) {
        const along = car.axis === 'v' ? car.y : car.x;
        if (Math.abs(along - cross) < speed * dt * 0.6 + 2 && state.rng.chance(0.22)) {
          if (car.axis === 'v') {
            car.axis = 'h';
            car.road = cross;
            car.dir = state.rng.chance(0.5) ? 1 : -1;
            car.angle = car.dir > 0 ? 0 : Math.PI;
            car.y = cross + (state.rng.chance(0.5) ? 1 : -1) * (ROAD_W / 4);
          } else {
            car.axis = 'v';
            car.road = cross;
            car.dir = state.rng.chance(0.5) ? 1 : -1;
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            car.x = cross + (state.rng.chance(0.5) ? 1 : -1) * (ROAD_W / 4);
          }
          break;
        }
      }
      if (car.axis === 'v') {
        if (ny < 60 || ny > WORLD.height - 60) { car.dir *= -1; car.angle += Math.PI; }
        else car.y = ny;
      } else {
        if (nx < 60 || nx > BEACH_X - 60) { car.dir *= -1; car.angle += Math.PI; }
        else car.x = nx;
      }
      // Bumping another car slows both down.
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        if (dist(car.x, car.y, other.x, other.y) < 44) {
          car.speed = Math.max(60, car.speed * 0.9);
        }
      }
    }
  }

  function stepPeds(dt, audio) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      ped.attackCd = Math.max(0, ped.attackCd - dt);
      if (ped.kind === 'cop') {
        // Foot police chase the player while wanted, and swing when close.
        if (state.wanted > 0) {
          const d = dist(ped.x, ped.y, p.x, p.y);
          const chaseSpeed = POLICE.footSpeed + state.wanted * 12;
          if (d > 26) {
            const a = angleTo(ped.x, ped.y, p.x, p.y);
            ped.angle = a;
            const nx = ped.x + Math.cos(a) * chaseSpeed * dt;
            const ny = ped.y + Math.sin(a) * chaseSpeed * dt;
            if (!hitsBuilding(state.city, nx, ny, PED.radius)) { ped.x = nx; ped.y = ny; }
          } else if (p.inCar === null && ped.attackCd <= 0 && p.invuln <= 0) {
            ped.attackCd = 0.9;
            p.health -= 9;
            p.invuln = 0.5;
            audio.hit();
            if (p.health <= 0) { p.health = 0; state.gameOver = true; }
          }
        } else {
          // Off duty: stroll the sidewalk like anyone else.
          wanderPed(ped, dt);
        }
        continue;
      }
      // A pedestrian flees a nearby speeding car or a fight.
      const threat = state.cars.some((c) => c.kind === 'player' && Math.abs(c.speed) > 150 && dist(c.x, c.y, ped.x, ped.y) < 130);
      if (threat || (state.wanted > 0 && dist(ped.x, ped.y, p.x, p.y) < 90)) {
        const away = angleTo(p.x, p.y, ped.x, ped.y);
        ped.angle = away;
        ped.x = clamp(ped.x + Math.cos(away) * ped.speed * 1.6 * dt, 40, WORLD.width - 40);
        ped.y = clamp(ped.y + Math.sin(away) * ped.speed * 1.6 * dt, 40, WORLD.height - 40);
        continue;
      }
      wanderPed(ped, dt);
    }
  }

  function wanderPed(ped, dt) {
    ped.wanderTimer -= dt;
    if (ped.wanderTimer <= 0 || dist(ped.x, ped.y, ped.targetX, ped.targetY) < 12) {
      // Pick a new stroll target on a nearby sidewalk.
      const road = nearestRoad(ped.x, ped.y);
      if (road) {
        const side = state.rng.chance(0.5) ? 1 : -1;
        const along = road.along + state.rng.range(-260, 260);
        if (road.axis === 'v') {
          ped.targetX = clamp(road.at + side * (ROAD_W / 2 + 16), 40, WORLD.width - 40);
          ped.targetY = clamp(along, 40, WORLD.height - 40);
        } else {
          ped.targetX = clamp(along, 40, WORLD.width - 40);
          ped.targetY = clamp(road.at + side * (ROAD_W / 2 + 16), 40, WORLD.height - 40);
        }
      } else {
        ped.targetX = clamp(ped.x + state.rng.range(-200, 200), 40, WORLD.width - 40);
        ped.targetY = clamp(ped.y + state.rng.range(-200, 200), 40, WORLD.height - 40);
      }
      ped.wanderTimer = state.rng.range(4, 9);
    }
    const a = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt;
    const ny = ped.y + Math.sin(a) * ped.speed * dt;
    if (!hitsBuilding(state.city, nx, ny, PED.radius)) { ped.x = nx; ped.y = ny; }
  }

  function stepPolice(dt, audio) {
    const p = state.player;
    if (state.wanted === 0) {
      // Stand down: police cars cruise away and despawn.
      for (const car of state.cars) {
        if (car.kind === 'police') {
          car.speed = Math.max(0, car.speed - 200 * dt);
          if (car.speed === 0) car.despawn = true;
        }
      }
      state.cars = state.cars.filter((c) => !c.despawn);
      return;
    }
    const wantCars = POLICE.carsByStars[state.wanted];
    const wantFoot = POLICE.footByStars[state.wanted];
    const haveCars = state.cars.filter((c) => c.kind === 'police').length;
    const haveFoot = state.peds.filter((x) => x.kind === 'cop' && x.down <= 0).length;
    for (let i = haveCars; i < wantCars; i += 1) {
      const road = nearestRoad(p.x + state.rng.range(-500, 500), p.y + state.rng.range(-500, 500));
      const spawnX = road.axis === 'v' ? road.at : clamp(p.x + (state.rng.chance(0.5) ? 420 : -420), 80, WORLD.width - 80);
      const spawnY = road.axis === 'h' ? road.at : clamp(p.y + (state.rng.chance(0.5) ? 420 : -420), 80, WORLD.height - 80);
      addCar({
        kind: 'police', x: spawnX, y: spawnY, angle: 0, speed: POLICE.carSpeed,
        dir: 1, axis: 'v', road: spawnX, color: '#2b4acb', stolen: false, parked: false,
      });
    }
    for (let i = haveFoot; i < wantFoot; i += 1) {
      const a = state.rng.range(0, Math.PI * 2);
      spawnPed(
        clamp(p.x + Math.cos(a) * 260, 60, WORLD.width - 60),
        clamp(p.y + Math.sin(a) * 260, 60, WORLD.height - 60),
        'cop',
      );
    }
    // Police cars hunt: steer straight at the player and ram.
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      const target = angleTo(car.x, car.y, p.x, p.y);
      car.angle = turnToward(car.angle, target, 2.2, dt);
      const speed = Math.min(POLICE.carSpeed + state.wanted * 14, 520);
      car.x += Math.cos(car.angle) * speed * dt;
      car.y += Math.sin(car.angle) * speed * dt;
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, WORLD.height - 40);
      car.speed = speed;
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 40 && p.invuln <= 0) {
        if (p.inCar !== null) {
          const myCar = state.cars.find((c) => c.id === p.inCar);
          if (myCar) myCar.speed *= 0.55;
          audio.hit();
          p.invuln = 0.6;
        } else {
          p.health -= 12;
          p.invuln = 0.7;
          audio.hit();
          if (p.health <= 0) { p.health = 0; state.gameOver = true; }
        }
      }
    }
    // Wanted decays after a quiet stretch with no new crime.
    state.crimeTimer += dt;
    if (state.crimeTimer > POLICE.decaySeconds) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.crimeTimer = 0;
      showToast(`Wanted level ${state.wanted} — the heat is cooling off.`, 2.5);
    }
  }

  function stepMissions(dt, audio) {
    if (state.storyComplete || state.missionIndex >= MISSIONS.length) return;
    const p = state.player;
    const target = missionTarget();
    if (!target) return;
    const d = dist(p.x, p.y, target.x, target.y);
    if (state.missionIndex === 3) {
      // Tail: bank time while close to the courier, lose it while far.
      if (d < 280) state.missionProgress += dt;
      else state.missionProgress = Math.max(0, state.missionProgress - dt * 0.5);
      if (state.missionProgress >= 6) completeMission(audio);
      return;
    }
    if (state.missionIndex === 4) {
      // Escape: the safehouse only counts once the wanted level is gone.
      if (state.wanted === 0 && d < 70) completeMission(audio);
      return;
    }
    if (state.missionIndex === 2 && state.missionStage === 0) {
      if (d < 70) {
        state.missionStage = 1;
        state.cash += 50;
        audio.pickup();
        showToast('Stash collected (+$50). Now reach the Sunset Diner.', 4);
      }
      return;
    }
    if (d < 70) completeMission(audio);
  }

  function stepPickups(dt, audio) {
    const p = state.player;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (dist(p.x, p.y, pickup.x, pickup.y) < 40) {
        pickup.taken = true;
        state.cash += pickup.value;
        audio.cash();
        showToast(`+$${pickup.value}`, 2);
      }
    }
    state.pickups = state.pickups.filter((x) => !x.taken);
  }

  function spawnCashPickups() {
    if (state.pickups.length > 0) return;
    const spots = [
      { x: 1200, y: 560 }, { x: 2080, y: 1560 }, { x: 1640, y: 300 },
      { x: 760, y: 1980 }, { x: 2520, y: 1140 },
    ];
    for (const s of spots) state.pickups.push({ x: s.x, y: s.y, value: 25, taken: false });
  }

  function step(dt, controls, audio) {
    if (state.gameOver) return 0;
    state.time += dt;
    state.clockMinutes += CLOCK.minutesPerSecond * dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.toastTimer > 0) state.toastTimer -= dt;
    spawnCashPickups();
    stepPlayer(dt, controls, audio);
    stepTraffic(dt);
    stepPeds(dt, audio);
    stepPolice(dt, audio);
    stepMissions(dt, audio);
    stepPickups(dt, audio);
    state.missionTarget = missionTarget();
    // Slow health recovery while the streets are calm.
    if (state.wanted === 0 && state.player.health > 0 && state.player.health < PLAYER.health) {
      state.player.health = Math.min(PLAYER.health, state.player.health + 1.5 * dt);
    }
    if (state.gameOver) {
      audio.fail();
      return EVENT_GAMEOVER;
    }
    return 0;
  }

  reset();

  return {
    state,
    reset,
    step,
    loadSave,
    applySave,
    saveGame,
    missionTarget,
    addWanted,
    showToast,
    showBanner,
    get missions() { return MISSIONS; },
    get storyComplete() { return state.storyComplete; },
  };
}
