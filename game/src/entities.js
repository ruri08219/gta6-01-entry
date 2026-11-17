// Vice Shores' rules and state: the player on foot and in cars, traffic and
// pedestrians, the wanted level and the police, combat, cash and the missions.
// No drawing and no browser in here: step() advances one fixed step and pushes
// what happened onto state.events for the loop to react to (sounds, banners).
import { buildCity, hitsBuilding, isRoadTile, nearestRoadTile, TILE, WORLD, walkable } from './city.js';
import { createRng } from './rng.js';
import { missionByIndex, missionCount } from './missions.js';

export const STEP = 1 / 60;
export const SAVE_KEY = 'vice-shores.save.v1';

export const EV_COIN = 'coin';
export const EV_PUNCH = 'punch';
export const EV_CRIME = 'crime';
export const EV_MISSION = 'mission';
export const EV_BUSTED = 'busted';
export const EV_STORY = 'story';
export const EV_CRASH = 'crash';
export const EV_HORN = 'horn';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93c', '#7a4fd0', '#3fae8a', '#e07b39', '#c9ced6', '#4a5568'];
const PED_SHIRTS = ['#e8e4d8', '#5b8fd9', '#d95f6e', '#63b06a', '#e0a53c', '#8a6fd0', '#d97b4f'];
const WALK_SPEED = 175;
const CAR_ACCEL = 300;
const CAR_MAX = 430;
const CAR_REVERSE = 130;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function dirVec(dir) {
  return [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][dir];
}

export function createGame(seed) {
  const rng = createRng(seed);
  const city = buildCity(seed);

  const state = {
    seed,
    city,
    rng,
    elapsed: 0,
    clockMin: 9 * 60,
    events: [],
    player: {
      x: city.spawn.x, y: city.spawn.y, angle: -Math.PI / 2,
      health: 100, inCar: null, punchCd: 0, punchAnim: 0,
      hurtCd: 0, crashCd: 0, moving: false,
    },
    cars: [],
    peds: [],
    cops: [],
    copCars: [],
    bags: [],
    wanted: 0,
    crimeTimer: 99,
    cash: 0,
    missionIndex: 0,
    dialog: null,
    banner: null,
    bannerTimer: 0,
    collectedBags: 0,
    tailTime: 0,
    stolenGold: false,
    heatRaised: false,
    storyComplete: false,
    gameOver: false,
    busted: false,
    camera: { x: city.spawn.x, y: city.spawn.y },
    stats: { carsStolen: 0, pedsDown: 0, missionsDone: 0 },
    sirenTimer: 0,
  };

  let carSeq = 0;
  function addCar(props) {
    const car = {
      id: carSeq += 1,
      x: 0, y: 0, angle: 0, dir: 0, speed: 0, targetSpeed: 0,
      color: '#d94f3d', kind: 'sedan', owner: 'traffic',
      ai: true, turnCd: 0, turnFrom: 0, turnTo: 0, turnT: 1,
      stopTimer: 0, wanderTarget: null, locked: false, ...props,
    };
    state.cars.push(car);
    return car;
  }

  function randomRoadSpot(nearX, nearY, minD, maxD) {
    for (let tries = 0; tries < 40; tries += 1) {
      const tx = rng.int(0, 47);
      const ty = rng.int(0, 47);
      if (!isRoadTile(tx, ty)) continue;
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      const d = dist(x, y, nearX, nearY);
      if (d >= minD && d <= maxD) return { x, y, tx, ty };
    }
    return { x: 7.5 * TILE, y: 7.5 * TILE, tx: 7, ty: 7 };
  }

  function spawnTrafficCar(nearX, nearY) {
    const spot = randomRoadSpot(nearX, nearY, 350, 1200);
    const dir = rng.int(0, 3);
    const car = addCar({
      x: spot.x, y: spot.y, dir, angle: dir * Math.PI / 2,
      speed: rng.range(60, 95), targetSpeed: rng.range(60, 95),
      color: rng.pick(CAR_COLORS), kind: rng.pick(['sedan', 'sedan', 'taxi', 'van']),
      owner: 'traffic',
    });
    return car;
  }

  function spawnParkedCar(x, y, angle, color, kind, owner) {
    return addCar({
      x, y, angle, dir: 0, speed: 0, targetSpeed: 0,
      color, kind: kind || 'sedan', owner: owner || 'parked', ai: false,
    });
  }

  function spawnPed(nearX, nearY) {
    for (let tries = 0; tries < 30; tries += 1) {
      const x = rng.range(60, WORLD - 60);
      const y = rng.range(60, WORLD - 60);
      if (!walkable(city, x, y, 12)) continue;
      if (nearX !== undefined && dist(x, y, nearX, nearY) < 200) continue;
      const ped = {
        x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(38, 58),
        tx: x, ty: y, shirt: rng.pick(PED_SHIRTS), skin: rng.pick(['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0']),
        flee: 0, fleeX: 0, fleeY: 0, down: false, downTimer: 0, idle: rng.range(0, 2),
      };
      state.peds.push(ped);
      return ped;
    }
    return null;
  }

  function laneLine(car) {
    // Right-hand traffic: each direction hugs its own side of the road.
    const tx = Math.floor(car.x / TILE);
    const ty = Math.floor(car.y / TILE);
    if (car.dir === 0) return { axis: 'y', at: ty * TILE + TILE / 2 + 9 };
    if (car.dir === 2) return { axis: 'y', at: ty * TILE + TILE / 2 - 9 };
    if (car.dir === 1) return { axis: 'x', at: tx * TILE + TILE / 2 - 9 };
    return { axis: 'x', at: tx * TILE + TILE / 2 + 9 };
  }

  function atCrossing(car) {
    const tx = car.x / TILE;
    const ty = car.y / TILE;
    const nx = Math.round(tx / 7) * 7;
    const ny = Math.round(ty / 7) * 7;
    if (nx < 0 || ny < 0 || nx > 47 || ny > 47) return false;
    const cx = nx * TILE + TILE / 2;
    const cy = ny * TILE + TILE / 2;
    return Math.abs(car.x - cx) < 13 && Math.abs(car.y - cy) < 13;
  }

  function chooseDirection(car, targetTile) {
    const options = [0, 1, 2, 3].filter((d) => d !== (car.dir + 2) % 4);
    if (!targetTile) return rng.pick(options);
    let best = options[0];
    let bestScore = Infinity;
    for (const d of options) {
      const v = dirVec(d);
      const nx = Math.floor(car.x / TILE) + v.x;
      const ny = Math.floor(car.y / TILE) + v.y;
      const score = Math.abs(nx - targetTile.tx) + Math.abs(ny - targetTile.ty) + rng.next() * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  }

  function stepAiCar(car, dt, targetTile) {
    if (car.stopTimer > 0) {
      car.stopTimer -= dt;
      car.speed = Math.max(0, car.speed - 200 * dt);
    } else {
      // Slow down for the car ahead.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.speed === 0 && !other.ai) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 62 && side < 22) { blocked = true; break; }
      }
      const want = blocked ? 0 : car.targetSpeed;
      car.speed += Math.max(-260 * dt, Math.min(180 * dt, want - car.speed));
    }

    if (car.turnCd > 0) car.turnCd -= dt;
    if (car.turnT < 1) {
      car.turnT = Math.min(1, car.turnT + dt / 0.35);
      car.angle = angleLerp(car.turnFrom, car.turnTo, car.turnT);
    } else if (atCrossing(car) && car.turnCd <= 0) {
      const next = chooseDirection(car, targetTile);
      if (next !== car.dir) {
        car.turnFrom = car.angle;
        car.dir = next;
        car.turnTo = next * Math.PI / 2;
        car.turnT = 0;
        car.turnCd = 1.2;
      } else {
        car.turnCd = 0.4;
      }
    }

    const vx = Math.cos(car.angle);
    const vy = Math.sin(car.angle);
    let nx = car.x + vx * car.speed * dt;
    let ny = car.y + vy * car.speed * dt;
    // Stay on the road: ease onto the lane line.
    const lane = laneLine(car);
    if (lane.axis === 'y') ny += (lane.at - ny) * Math.min(1, 2.5 * dt);
    else nx += (lane.at - nx) * Math.min(1, 2.5 * dt);
    if (walkable(city, nx, ny, 15)) {
      car.x = nx;
      car.y = ny;
    } else {
      // Bumped into a building corner: turn around at the next crossing.
      car.speed = Math.max(0, car.speed - 300 * dt);
    }
    car.x = Math.max(16, Math.min(WORLD - 16, car.x));
    car.y = Math.max(16, Math.min(WORLD - 16, car.y));
  }

  function addCrime(amount) {
    state.wanted = Math.min(5, state.wanted + amount);
    state.crimeTimer = 0;
    state.events.push(EV_CRIME);
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function playerCar() {
    if (state.player.inCar === null) return null;
    return state.cars.find((c) => c.id === state.player.inCar) || null;
  }

  function spawnBag(x, y) {
    state.bags.push({ x, y, taken: false });
  }

  function startMission(index) {
    const m = missionByIndex(index);
    if (!m) return;
    state.collectedBags = 0;
    state.tailTime = 0;
    state.stolenGold = false;
    state.heatRaised = false;
    state.bags = [];
    state.dialog = { giver: m.giver, name: m.name, text: m.intro };
    if (m.kind === 'collect') {
      spawnBag(city.market.x + 60, city.market.y + 40);
      spawnBag(city.docks.x - 40, city.docks.y + 30);
      spawnBag(city.park.x + 50, city.park.y - 30);
    }
    if (m.kind === 'tail') {
      const spot = randomRoadSpot(state.player.x, state.player.y, 300, 700);
      const courier = addCar({
        x: spot.x, y: spot.y, dir: 0, angle: 0,
        speed: 85, targetSpeed: 85, color: '#2fa8a0', kind: 'van',
        owner: 'courier', locked: true,
      });
      courier.wanderTarget = { tx: 35, ty: 35 };
      state.courierId = courier.id;
    }
  }

  function completeMission() {
    const m = missionByIndex(state.missionIndex);
    if (!m) return;
    state.cash += m.reward;
    state.stats.missionsDone += 1;
    state.events.push(EV_MISSION);
    state.banner = `Mission complete: ${m.name}  +$${m.reward}`;
    state.bannerTimer = 4;
    state.missionIndex += 1;
    if (state.courierId) {
      state.cars = state.cars.filter((c) => c.id !== state.courierId);
      state.courierId = null;
    }
    if (state.missionIndex >= missionCount()) {
      state.storyComplete = true;
      state.events.push(EV_STORY);
      state.banner = 'Story complete! Vice Shores is yours, Rook. Free roam unlocked.';
      state.bannerTimer = 6;
    } else {
      startMission(state.missionIndex);
    }
  }

  function missionTargetPos() {
    const m = missionByIndex(state.missionIndex);
    if (!m) return null;
    if (m.kind === 'tail' && state.courierId) {
      const c = state.cars.find((x) => x.id === state.courierId);
      if (c) return { x: c.x, y: c.y };
    }
    if (m.kind === 'steal' && !state.stolenGold) {
      const g = state.cars.find((x) => x.owner === 'gold');
      if (g) return { x: g.x, y: g.y };
    }
    if (m.kind === 'collect') {
      const bag = state.bags.find((b) => !b.taken);
      if (bag) return { x: bag.x, y: bag.y };
    }
    const spots = {
      market: city.market, garage: city.garage, pier: city.pier,
      safehouse: city.safehouse, docks: city.docks,
    };
    const s = spots[m.target];
    return s ? { x: s.x, y: s.y } : null;
  }

  function reset(full) {
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.copCars = [];
    state.bags = [];
    state.courierId = null;
    state.elapsed = 0;
    state.clockMin = 9 * 60;
    state.wanted = 0;
    state.crimeTimer = 99;
    state.gameOver = false;
    state.busted = false;
    state.storyComplete = false;
    state.banner = null;
    state.bannerTimer = 0;
    state.tailTime = 0;
    state.stolenGold = false;
    state.heatRaised = false;
    state.collectedBags = 0;
    if (full) {
      state.cash = 0;
      state.missionIndex = 0;
      state.stats = { carsStolen: 0, pedsDown: 0, missionsDone: 0 };
    }
    const p = state.player;
    p.x = city.spawn.x;
    p.y = city.spawn.y;
    p.angle = -Math.PI / 2;
    p.health = 100;
    p.inCar = null;
    p.punchCd = 0;
    p.punchAnim = 0;
    p.hurtCd = 0;
    p.crashCd = 0;
    state.camera.x = p.x;
    state.camera.y = p.y;

    // Parked cars along the roads.
    spawnParkedCar(7.5 * TILE, 3.5 * TILE + 18, 0, '#d94f3d', 'sedan', 'parked');
    spawnParkedCar(14.5 * TILE, 10.5 * TILE - 18, Math.PI, '#3d7bd9', 'sedan', 'parked');
    spawnParkedCar(21.5 * TILE, 17.5 * TILE + 18, 0, '#e8b93c', 'taxi', 'parked');
    spawnParkedCar(28.5 * TILE, 24.5 * TILE - 18, Math.PI, '#7a4fd0', 'sedan', 'parked');
    spawnParkedCar(35.5 * TILE, 31.5 * TILE + 18, 0, '#c9ced6', 'van', 'parked');
    // The gold sedan for mission 2, parked by the Docks.
    spawnParkedCar(city.docks.x + 30, city.docks.y - 14, Math.PI / 2, '#f2c230', 'gold', 'gold');
    for (let i = 0; i < 13; i += 1) spawnTrafficCar(p.x, p.y);
    for (let i = 0; i < 26; i += 1) spawnPed();
    startMission(state.missionIndex);
  }

  function enterExitCar() {
    const p = state.player;
    if (p.inCar !== null) {
      const car = playerCar();
      if (car) {
        const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
        let ex = car.x + side.x * 30;
        let ey = car.y + side.y * 30;
        if (!walkable(city, ex, ey, 12)) {
          ex = car.x - side.x * 30;
          ey = car.y - side.y * 30;
        }
        p.x = ex;
        p.y = ey;
        p.angle = car.angle;
      }
      p.inCar = null;
      return;
    }
    const car = nearestCar(p.x, p.y, 58);
    if (!car || car.locked) return;
    if (car.owner === 'cop') {
      addCrime(2);
      state.banner = 'You stole a police cruiser! The whole city is coming.';
      state.bannerTimer = 3;
    } else if (car.owner !== 'player') {
      const copNear = state.copCars.some((c) => dist(c.x, c.y, p.x, p.y) < 450)
        || state.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 200);
      const pedNear = state.peds.some((pd) => !pd.down && dist(pd.x, pd.y, p.x, p.y) < 170);
      addCrime(copNear || pedNear ? 1 : 0.5);
      state.stats.carsStolen += 1;
      if (car.owner === 'gold') state.stolenGold = true;
    }
    car.owner = 'player';
    car.ai = false;
    car.speed = 0;
    p.inCar = car.id;
    p.angle = car.angle;
    state.events.push(EV_HORN);
  }

  function punch() {
    const p = state.player;
    if (p.inCar !== null || p.punchCd > 0) return;
    p.punchCd = 0.35;
    p.punchAnim = 0.22;
    state.events.push(EV_PUNCH);
    const fx = Math.cos(p.angle);
    const fy = Math.sin(p.angle);
    let hitSomeone = false;
    for (const ped of state.peds) {
      if (ped.down) continue;
      const dx = ped.x - p.x;
      const dy = ped.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 48 && (dx * fx + dy * fy) / Math.max(d, 1) > 0.3) {
        ped.down = true;
        ped.downTimer = 4;
        ped.flee = 6;
        state.stats.pedsDown += 1;
        hitSomeone = true;
      }
    }
    for (const cop of state.cops) {
      if (cop.down) continue;
      const dx = cop.x - p.x;
      const dy = cop.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 52 && (dx * fx + dy * fy) / Math.max(d, 1) > 0.3) {
        cop.health -= 1;
        hitSomeone = true;
        if (cop.health <= 0) {
          cop.down = true;
          cop.downTimer = 6;
          cop.health = 3;
        }
        addCrime(0.5);
      }
    }
    if (hitSomeone) addCrime(0.3);
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.punchAnim > 0) p.punchAnim -= dt;
    if (p.hurtCd > 0) p.hurtCd -= dt;
    if (p.crashCd > 0) p.crashCd -= dt;
    const car = playerCar();

    if (car) {
      // Driving: W accelerates, S brakes/reverses, A/D steer.
      const steer = input.steer();
      const spd = car.speed;
      if (input.throttle()) car.speed += CAR_ACCEL * dt;
      else if (input.brake()) car.speed -= (spd > 0 ? 420 : 200) * dt;
      else car.speed -= Math.sign(spd) * Math.min(Math.abs(spd), 120 * dt);
      if (spd > 0 && steer !== 0) {
        car.angle += steer * (1.9 * Math.min(1, Math.abs(spd) / 160) * dt) * (spd > 0 ? 1 : -1);
      }
      if (spd < 0 && steer !== 0) {
        car.angle -= steer * (1.4 * Math.min(1, Math.abs(spd) / 120) * dt);
      }
      car.speed = Math.max(-CAR_REVERSE, Math.min(CAR_MAX, car.speed));
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (walkable(city, nx, ny, 15)) {
        car.x = nx;
        car.y = ny;
      } else {
        if (Math.abs(car.speed) > 280 && p.crashCd <= 0) {
          p.health -= 8;
          p.crashCd = 0.6;
          state.events.push(EV_CRASH);
          addCrime(0.2);
        }
        car.speed *= 0.4;
      }
      // Hitting pedestrians while driving.
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (dist(ped.x, ped.y, car.x, car.y) < 24 && Math.abs(car.speed) > 60) {
          ped.down = true;
          ped.downTimer = 5;
          ped.flee = 8;
          state.stats.pedsDown += 1;
          addCrime(0.6);
          car.speed *= 0.75;
          state.events.push(EV_CRASH);
        }
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.moving = Math.abs(car.speed) > 20;
      return car;
    }

    // On foot.
    const mv = input.move();
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.angle = Math.atan2(mv.y, mv.x);
      const nx = p.x + mv.x * WALK_SPEED * dt;
      const ny = p.y + mv.y * WALK_SPEED * dt;
      if (walkable(city, nx, p.y, 12)) p.x = nx;
      if (walkable(city, p.x, ny, 12)) p.y = ny;
    }
    return null;
  }

  function stepPeds(dt) {
    const p = state.player;
    const car = playerCar();
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.flee = 5;
        }
        continue;
      }
      if (ped.idle > 0) {
        ped.idle -= dt;
        continue;
      }
      let tx = ped.tx;
      let ty = ped.ty;
      let speed = ped.speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const d = Math.max(1, dist(ped.x, ped.y, ped.fleeX, ped.fleeY));
        tx = ped.x + ((ped.x - ped.fleeX) / d) * 120;
        ty = ped.y + ((ped.y - ped.fleeY) / d) * 120;
        speed = 130;
      } else if (car && dist(ped.x, ped.y, car.x, car.y) < 70 && Math.abs(car.speed) > 150) {
        // Scatter from a speeding car.
        ped.flee = 1.5;
        ped.fleeX = car.x;
        ped.fleeY = car.y;
        continue;
      } else if (dist(ped.x, ped.y, tx, ty) < 12) {
        // Pick a new stroll target nearby.
        for (let tries = 0; tries < 12; tries += 1) {
          const nx = ped.x + rng.range(-260, 260);
          const ny = ped.y + rng.range(-260, 260);
          if (walkable(city, nx, ny, 12)) {
            ped.tx = nx;
            ped.ty = ny;
            break;
          }
        }
        ped.idle = rng.range(0.5, 2.5);
        continue;
      }
      const dx = tx - ped.x;
      const dy = ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        ped.angle = Math.atan2(dy, dx);
        const step = Math.min(d, speed * dt);
        const nx = ped.x + (dx / d) * step;
        const ny = ped.y + (dy / d) * step;
        if (walkable(city, nx, ped.y, 11)) ped.x = nx;
        if (walkable(city, ped.x, ny, 11)) ped.y = ny;
      }
    }
  }

  function wantedStars() {
    if (state.wanted <= 0.25) return 0;
    return Math.max(1, Math.min(5, Math.round(state.wanted)));
  }

  function stepCops(dt) {
    const p = state.player;
    const stars = wantedStars();
    const wantFoot = stars;
    const wantCars = stars >= 2 ? Math.min(4, stars - 1) : 0;

    while (state.cops.length < wantFoot) {
      const spot = randomRoadSpot(p.x, p.y, 380, 650);
      state.cops.push({ x: spot.x, y: spot.y, angle: 0, health: 3, down: false, downTimer: 0 });
    }
    while (state.copCars.length < wantCars) {
      const spot = randomRoadSpot(p.x, p.y, 400, 700);
      const car = addCar({
        x: spot.x, y: spot.y, dir: 0, angle: 0,
        speed: 120, targetSpeed: 210, color: '#1f2a44', kind: 'cop',
        owner: 'cop', ai: true,
      });
      state.copCars.push(car);
    }
    if (stars === 0) {
      // Heat gone: the law stands down.
      state.cops = [];
      for (const c of state.copCars) state.cars = state.cars.filter((x) => x !== c);
      state.copCars = [];
    }

    // Foot cops run the player down.
    for (const cop of state.cops) {
      if (cop.down) {
        cop.downTimer -= dt;
        if (cop.downTimer <= 0) {
          cop.down = false;
          cop.health = 3;
        }
        continue;
      }
      const dx = p.x - cop.x;
      const dy = p.y - cop.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        cop.angle = Math.atan2(dy, dx);
        const speed = 155;
        const nx = cop.x + (dx / d) * speed * dt;
        const ny = cop.y + (dy / d) * speed * dt;
        if (walkable(city, nx, cop.y, 11)) cop.x = nx;
        if (walkable(city, cop.x, ny, 11)) cop.y = ny;
      }
      if (d < 26 && p.inCar === null && p.hurtCd <= 0) {
        p.health -= 12;
        p.hurtCd = 0.7;
        state.events.push(EV_CRASH);
      }
    }

    // Cop cars chase along the roads toward the player's tile.
    const targetTile = nearestRoadTile(p.x, p.y);
    for (const copCar of state.copCars) {
      copCar.targetSpeed = 200 + stars * 12;
      stepAiCar(copCar, dt, targetTile);
      if (dist(copCar.x, copCar.y, p.x, p.y) < 34 && p.hurtCd <= 0) {
        p.health -= 10;
        p.hurtCd = 0.8;
        copCar.speed *= 0.4;
        state.events.push(EV_CRASH);
      }
    }
  }

  function stepTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (!car.ai) continue;
      if (car.owner === 'courier') {
        // The courier loops the city on a fixed route.
        stepAiCar(car, dt, car.wanderTarget || { tx: 35, ty: 35 });
        continue;
      }
      if (car.owner === 'cop') continue; // handled by stepCops
      stepAiCar(car, dt, null);
    }
    // Keep the streets busy: replace traffic cars that wandered too far away.
    let traffic = 0;
    for (const car of state.cars) if (car.ai && car.owner === 'traffic') traffic += 1;
    if (traffic < 12) spawnTrafficCar(p.x, p.y);
    // Car-car shoving so they never overlap.
    const all = state.cars;
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 34) {
          const push = (34 - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          if (a.ai || b.ai) {
            a.x -= ux * push * 0.5;
            a.y -= uy * push * 0.5;
            b.x += ux * push * 0.5;
            b.y += uy * push * 0.5;
          }
        }
      }
    }
  }

  function checkMission(dt) {
    const m = missionByIndex(state.missionIndex);
    if (!m || state.dialog) return;
    const p = state.player;
    const car = playerCar();
    const at = (spot, radius) => dist(p.x, p.y, spot.x, spot.y) < radius;
    if (m.kind === 'goto' && at(city.market, 70)) completeMission();
    else if (m.kind === 'steal') {
      if (state.stolenGold && car && car.owner === 'player' && car.kind === 'gold' && at(city.garage, 80)) {
        completeMission();
      }
    } else if (m.kind === 'tail' && state.courierId) {
      const c = state.cars.find((x) => x.id === state.courierId);
      if (c && car && dist(p.x, p.y, c.x, c.y) < 210) {
        state.tailTime += dt;
        if (state.tailTime >= 4) completeMission();
      } else {
        state.tailTime = Math.max(0, state.tailTime - dt * 0.5);
      }
    } else if (m.kind === 'escape') {
      if (state.wanted >= 1) state.heatRaised = true;
      if (state.heatRaised && at(city.pier, 80)) completeMission();
    } else if (m.kind === 'collect') {
      for (const bag of state.bags) {
        if (!bag.taken && dist(p.x, p.y, bag.x, bag.y) < 46) {
          bag.taken = true;
          state.collectedBags += 1;
          state.cash += 50;
          state.events.push(EV_COIN);
        }
      }
      if (state.collectedBags >= 3 && at(city.safehouse, 80)) completeMission();
    }
  }

  function step(dt, input, actions) {
    if (state.gameOver) return;
    state.elapsed += dt;
    state.clockMin += dt * 1.5;
    state.crimeTimer += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;

    // Wanted heat cools off when the player lies low.
    if (state.crimeTimer > 12 && state.wanted > 0) {
      state.wanted = Math.max(0, state.wanted - 0.1 * dt);
    }

    // Health comes back slowly when nobody is chasing.
    if (wantedStars() === 0 && state.player.hurtCd <= 0 && state.player.health < 100) {
      state.player.health = Math.min(100, state.player.health + 2.5 * dt);
    }

    if (state.dialog) {
      if (actions.confirm) state.dialog = null;
      return; // The city waits while Marla talks.
    }

    if (actions.enter) enterExitCar();
    if (actions.punch) punch();
    if (actions.horn) {
      state.events.push(EV_HORN);
      for (const ped of state.peds) {
        if (dist(ped.x, ped.y, state.player.x, state.player.y) < 130 && !ped.down) {
          ped.flee = 1.2;
          ped.fleeX = state.player.x;
          ped.fleeY = state.player.y;
        }
      }
    }

    stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    stepCops(dt);
    checkMission(dt);

    // Siren wail while the heat is on.
    if (wantedStars() >= 2) {
      state.sirenTimer -= dt;
      if (state.sirenTimer <= 0) {
        state.sirenTimer = 2.4;
        state.events.push('siren');
      }
    }

    // Busted: health gone.
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.gameOver = true;
      state.busted = true;
      state.events.push(EV_BUSTED);
    }

    // Camera eases after the player (or their car).
    const p = state.player;
    state.camera.x += (p.x - state.camera.x) * Math.min(1, 5 * dt);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, 5 * dt);
  }

  function takeEvents() {
    const e = state.events;
    state.events = [];
    return e;
  }

  reset(true);

  return {
    state,
    reset,
    step,
    takeEvents,
    missionTargetPos,
    playerCar,
    wantedStars,
    startMission,
    saveData() {
      return {
        cash: state.cash,
        missionIndex: state.missionIndex,
        health: state.player.health,
      };
    },
    loadData(data) {
      if (!data) return;
      if (typeof data.cash === 'number') state.cash = data.cash;
      if (typeof data.missionIndex === 'number'
        && data.missionIndex >= 0 && data.missionIndex < missionCount()) {
        state.missionIndex = data.missionIndex;
      }
      if (typeof data.health === 'number') state.player.health = data.health;
      reset(false);
    },
  };
}
