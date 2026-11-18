// Solara Bay — main game: renderer, third-person player, driving, camera,
// menus, save flow and deterministic ?shot= scenes for screenshots.
import * as THREE from 'three';
import { GAME_TITLE, GAME_SUBTITLE, MISSIONS, CONTROLS_TEXT, CITY } from './config.js';
import { buildCity } from './world.js';
import { makeCarMesh, randomCarColor, createCar, driveCar, nearestCar } from './cars.js';
import { spawnTraffic, updateTraffic, spawnPedestrians, updatePedestrians } from './npcs.js';
import { WantedSystem } from './police.js';
import { MissionRunner } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
const city = buildCity(scene);

const sound = new SoundBank();
const input = new Input(canvas);
const hud = new HUD();
const wanted = new WantedSystem(scene, city.colliders);
const missions = new MissionRunner(scene);
const combat = new Combat(scene);
const traffic = spawnTraffic(scene, 12);
const pedestrians = spawnPedestrians(scene, 22);

// Parked, stealable cars along the roads.
const parked = [];
const parkedSpots = [
  [-29, 12, 0, 0], [29, -20, 1, Math.PI], [-87, 30, 2, 0], [29, -70, 3, Math.PI],
  [87, 8, 4, 0], [-145, -40, 5, Math.PI], [29, 70, 6, 0], [-87, -90, 0, Math.PI],
  [87, -60, 1, 0], [-29, 90, 2, Math.PI],
];
for (const [road, along, ci, heading] of parkedSpots) {
  const mesh = makeCarMesh(randomCarColor(ci), false);
  scene.add(mesh);
  const car = createCar(mesh, road + 5.5, along, heading);
  car.isParked = true;
  parked.push(car);
}

function makePlayerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.15, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x1f8a70 })
  );
  body.position.y = 1.1;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a })
  );
  head.position.y = 2.0;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.75, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x24344d })
  );
  legs.position.y = 0.38;
  group.add(legs);
  return group;
}

const playerMesh = makePlayerMesh();
scene.add(playerMesh);

const state = {
  mode: 'menu', // menu | playing | paused | won
  cash: 0,
  debtPaid: 0,
  player: {
    mesh: playerMesh,
    pos: new THREE.Vector3(0, 0, 20),
    heading: 0,
    vy: 0,
    health: 100,
    car: null,
    hurtCooldown: 0,
  },
  traffic, parked, wanted, missions, combat, sound, city,
};
window.__solara = { state, THREE };

// ---- player on foot -------------------------------------------------------
function movePlayerOnFoot(dt) {
  const p = state.player;
  const speed = input.run ? 10.5 : 6;
  let fx = 0, fz = 0;
  if (input.forward) { fx += Math.sin(p.heading); fz += Math.cos(p.heading); }
  if (input.back) { fx -= Math.sin(p.heading); fz -= Math.cos(p.heading); }
  if (input.left) { fx += Math.sin(p.heading - Math.PI / 2); fz += Math.cos(p.heading - Math.PI / 2); }
  if (input.right) { fx += Math.sin(p.heading + Math.PI / 2); fz += Math.cos(p.heading + Math.PI / 2); }
  const len = Math.hypot(fx, fz);
  if (len > 0) {
    fx /= len; fz /= len;
    const nx = p.pos.x + fx * speed * dt;
    const nz = p.pos.z + fz * speed * dt;
    if (!hitsBuilding(nx, p.pos.z)) p.pos.x = nx;
    if (!hitsBuilding(p.pos.x, nz)) p.pos.z = nz;
    p.heading = Math.atan2(fx, fz);
    p.mesh.position.y = Math.abs(Math.sin(performance.now() / 90)) * 0.06;
  }
  // Jump.
  if (input.jump && p.pos.y <= 0.01) p.vy = 7;
  p.vy -= 22 * dt;
  p.pos.y = Math.max(0, p.pos.y + p.vy * dt);
  if (p.pos.y === 0) p.vy = 0;
  p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
  p.mesh.rotation.y = p.heading;
}

function hitsBuilding(x, z) {
  for (const c of city.colliders) {
    if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) return true;
  }
  return false;
}

// ---- enter / exit car ------------------------------------------------------
function tryEnterCar() {
  const p = state.player;
  const all = [...parked, ...traffic];
  const car = nearestCar(all, p.pos.x, p.pos.z, 5);
  if (!car) { hud.message('No car close by — walk to a parked car.'); return; }
  const wasParked = parked.includes(car);
  if (wasParked) parked.splice(parked.indexOf(car), 1);
  else traffic.splice(traffic.indexOf(car), 1);
  car.isPlayer = true;
  p.car = car;
  p.mesh.visible = false;
  wanted.addHeat(120, 'steal');
  sound.pickup();
  hud.message('Car stolen! The Bay PD noticed — watch the stars.');
  if (missions.current && missions.current.type === 'steal') {
    const msg = missions.update(state);
    if (msg) onMissionEvent(msg);
  }
}

function exitCar() {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  car.isPlayer = false;
  car.speed = 0;
  car.isParked = true;
  parked.push(car);
  p.pos.set(car.x + Math.sin(car.heading + Math.PI / 2) * 2.5, 0, car.z + Math.cos(car.heading + Math.PI / 2) * 2.5);
  p.heading = car.heading;
  p.mesh.visible = true;
}

function onMissionEvent(msg) {
  hud.message(msg, 7000);
  if (msg.startsWith('MISSION COMPLETE')) {
    saveGame(state);
    if (missions.done) showWin();
  }
}

// ---- camera ----------------------------------------------------------------
let camYaw = Math.PI;
let camPitch = 0.42;
function updateCamera(dt) {
  const drag = input.consumeDrag();
  camYaw -= drag.dx * 0.005;
  camPitch = Math.max(0.15, Math.min(1.1, camPitch + drag.dy * 0.004));
  const p = state.player;
  const focus = p.car
    ? new THREE.Vector3(p.car.x, 1.6, p.car.z)
    : new THREE.Vector3(p.pos.x, 1.8, p.pos.z);
  const dist = p.car ? 13 : 9;
  const height = dist * Math.sin(camPitch) + 1.5;
  const back = dist * Math.cos(camPitch);
  const cx = focus.x + Math.sin(camYaw) * back;
  const cz = focus.z + Math.cos(camYaw) * back;
  camera.position.lerp(new THREE.Vector3(cx, height, cz), Math.min(1, dt * 6));
  camera.lookAt(focus.x, focus.y, focus.z);
}

// ---- damage / death ---------------------------------------------------------
function hurtPlayer(amount, cause) {
  const p = state.player;
  if (p.hurtCooldown > 0) return;
  p.hurtCooldown = 0.9;
  p.health -= amount;
  hud.setHealth(p.health);
  if (p.health <= 0) {
    p.health = 100;
    hud.setHealth(100);
    state.cash = Math.max(0, state.cash - 100);
    wanted.setLevel(0);
    if (p.car) { exitCar(); }
    p.pos.set(0, 0, 20);
    p.mesh.position.copy(p.pos);
    hud.message('Wasted! The Bay clinic patched you up — $100 bill. (' + cause + ')', 8000);
  }
}

// ---- menus ------------------------------------------------------------------
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnHow = document.getElementById('btn-how');
const btnResume = document.getElementById('btn-resume');
const btnSave = document.getElementById('btn-save');
const howPanel = document.getElementById('how-panel');

function showMenu() {
  state.mode = 'menu';
  overlay.classList.remove('hidden');
  overlayTitle.textContent = GAME_TITLE;
  overlayText.innerHTML =
    '<b>' + GAME_SUBTITLE + '</b><br><br>' +
    'Rico Vale is back in Solara Bay — and fixer Delia Cross wants her $50,000 back. ' +
    'Steal cars, outrun the Bay PD, run six jobs and take the city back.<br><br>' +
    'A sun-soaked open world: drive the grid, dodge traffic, lose the heat, get paid.';
  btnNew.textContent = 'New Game';
  btnNew.classList.remove('hidden');
  btnContinue.classList.toggle('hidden', !hasSave());
  btnResume.classList.add('hidden');
  btnSave.classList.add('hidden');
  howPanel.classList.add('hidden');
}

function startGame(fromSave) {
  sound.ensure();
  if (fromSave) {
    const s = loadGame();
    if (s) {
      state.cash = s.cash;
      state.debtPaid = s.debtPaid;
      missions.completed = s.completedMissions || [];
      missions.startMission(s.missionIndex || 0);
      state.player.pos.set(s.player.x, 0, s.player.z);
      state.player.health = s.health || 100;
    }
  } else {
    state.cash = 0;
    state.debtPaid = 0;
    missions.completed = [];
    missions.startMission(0);
    state.player.pos.set(0, 0, 20);
    state.player.health = 100;
  }
  combat.clear();
  wanted.setLevel(0);
  state.mode = 'playing';
  overlay.classList.add('hidden');
  hud.setHealth(state.player.health);
  hud.setCash(state.cash, state.debtPaid);
  const m = missions.current;
  if (m) {
    hud.setMission(m.title, m.objective);
    hud.message('MISSION: ' + m.title + ' — ' + m.brief, 9000);
  }
}

function showPause() {
  state.mode = 'paused';
  overlay.classList.remove('hidden');
  overlayTitle.textContent = 'PAUSED';
  overlayText.textContent = 'Solara Bay waits for no one — except now. Save your progress before you go.';
  btnNew.classList.add('hidden');
  btnContinue.classList.add('hidden');
  btnResume.classList.remove('hidden');
  btnSave.classList.remove('hidden');
}

function showWin() {
  state.mode = 'won';
  overlay.classList.remove('hidden');
  overlayTitle.textContent = 'BAY KING';
  overlayText.innerHTML =
    'All six jobs done. The debt is paid, Kade\'s crew is finished, and Solara Bay is yours, Rico.<br><br>' +
    'Final cash: $' + state.cash.toLocaleString() + ' — keep driving, the city never sleeps.';
  btnNew.textContent = 'Play Again';
  btnNew.classList.remove('hidden');
  btnContinue.classList.add('hidden');
  btnResume.classList.add('hidden');
  btnSave.classList.add('hidden');
}

btnNew.addEventListener('click', () => startGame(false));
btnContinue.addEventListener('click', () => startGame(true));
btnResume.addEventListener('click', () => { state.mode = 'playing'; overlay.classList.add('hidden'); });
btnSave.addEventListener('click', () => {
  saveGame(state);
  hud.message('Progress saved.');
});
btnHow.addEventListener('click', () => howPanel.classList.toggle('hidden'));

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && state.mode === 'playing' && !e.repeat) {
    if (state.player.car) exitCar();
    else tryEnterCar();
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
    if (state.mode === 'playing') showPause();
    else if (state.mode === 'paused') { state.mode = 'playing'; overlay.classList.add('hidden'); }
  }
  if (e.code === 'KeyM' && !e.repeat) {
    sound.ensure();
    hud.message(sound.toggleMute() ? 'Sound muted.' : 'Sound on.');
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- deterministic shot scenes ----------------------------------------------
function setupShot(n) {
  startGame(false);
  hud.el.feed.innerHTML = '';
  const p = state.player;
  if (n === '1') {
    // Start screen over a high city vista.
    showMenu();
    camera.position.set(120, 90, 150);
    camera.lookAt(0, 0, 0);
    return;
  }
  if (n === '2') {
    // On foot beside a car, traffic and pedestrians around, mission 1 live.
    p.pos.set(parked[0].x + 3, 0, parked[0].z + 4);
    p.heading = Math.PI;
    camYaw = Math.PI * 0.9;
    return;
  }
  if (n === '3') {
    // Police chase: driving at 3 stars with two PD cars on the tail.
    const car = parked[0];
    parked.splice(0, 1);
    car.isPlayer = true;
    p.car = car;
    p.mesh.visible = false;
    car.x = 29; car.z = 40; car.heading = 0; car.speed = 26;
    wanted.setLevel(3);
    wanted.police.forEach((pc, i) => {
      pc.x = i === 0 ? 20 : 38; pc.z = 58 + i * 6; pc.heading = 0; pc.speed = 24; pc.placed = true;
    });
    missions.startMission(3);
    state.autoDrive = true;
    hud.message('MISSION: Hot Pursuit — lose the Bay PD!', 9000);
    camYaw = Math.PI;
    return;
  }
  if (n === '4') {
    // Vault job in progress: cash grabbed, 3 stars, racing to the hideout.
    const car = parked[1];
    parked.splice(1, 1);
    car.isPlayer = true;
    p.car = car;
    p.mesh.visible = false;
    car.x = 29; car.z = 82; car.heading = Math.PI; car.speed = 24;
    missions.startMission(4);
    missions.stage = 1;
    missions.cashStolen = true;
    missions.placeBeacon();
    wanted.setLevel(3);
    wanted.police.forEach((pc, i) => {
      if (i === 0) { pc.x = 29; pc.z = 45; pc.heading = 0; }
      else { pc.x = 35; pc.z = 104; pc.heading = Math.PI; }
      pc.speed = 24; pc.placed = true;
    });
    combat.spawnSquad(44, 66, 2, 'bank guards');
    state.autoDrive = true;
    hud.message('MISSION: The Vault Job — cash grabbed! Escape to the hideout!', 9000);
    camYaw = 0;
  }
}

// ---- main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let enemySpawnCheck = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const p = state.player;

  if (state.mode === 'playing') {
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt);
    // Mission-linked enemy squads.
    const m = missions.current;
    if (m && m.type === 'defeat' && combat.enemyCount() === 0 && missions.defeated < m.count) {
      combat.spawnSquad(m.target.x, m.target.z, Math.min(3, m.count - missions.defeated), m.title);
    }
    if (p.car) {
      const driveInput = state.autoDrive
        ? { forward: true, back: false, left: false, right: false }
        : input;
      const crashed = driveCar(p.car, driveInput, dt, city.colliders);
      if (crashed) {
        sound.crash();
        if (Math.abs(p.car.speed) > 10) hurtPlayer(4, 'crash');
      }
      p.pos.set(p.car.x, 0, p.car.z);
      p.heading = p.car.heading;
      sound.setEngine(Math.abs(p.car.speed) / p.car.topSpeed, true);
    } else {
      movePlayerOnFoot(dt);
      sound.setEngine(0, false);
      if (input.consumeClick()) {
        const aim = new THREE.Vector3();
        camera.getWorldDirection(aim);
        aim.y = 0; aim.normalize();
        sound.shoot();
        const killed = combat.shoot(p.pos, aim);
        if (killed) {
          missions.defeated += 1;
          wanted.addHeat(60, 'shooting');
          state.cash += 25;
          hud.message('Thug down! +$25 street cash.');
        }
      }
    }
    updateTraffic(traffic, dt, p.car);
    updatePedestrians(pedestrians, dt);
    wanted.update(dt, p, p.car, (policeCar) => {
      hurtPlayer(8, 'rammed by Bay PD');
      p.car && (p.car.speed *= 0.5);
      sound.crash();
    });
    combat.update(dt, p.pos, () => hurtPlayer(5, 'thug attack'));
    const event = missions.update(state);
    if (event) onMissionEvent(event);
    // HUD refresh.
    hud.setCash(state.cash, state.debtPaid);
    hud.setWanted(wanted.level);
    if (missions.current) hud.setMission(missions.current.title, missions.objectiveText());
    else hud.setMission('SOLARA BAY', 'All missions complete — free roam!');
    hud.setSpeed(p.car ? Math.abs(p.car.speed) * 3.6 : 0, !!p.car);
    hud.drawMap(state, city);
    // Periodic autosave.
    enemySpawnCheck += dt;
    if (enemySpawnCheck > 20) { enemySpawnCheck = 0; saveGame(state); }
  } else if (state.mode === 'menu') {
    // Slow orbit over the city behind the start screen.
    const t = performance.now() * 0.00004;
    camera.position.set(Math.sin(t) * 170, 95, Math.cos(t) * 170);
    camera.lookAt(0, 0, 0);
    updateTraffic(traffic, dt, null);
    updatePedestrians(pedestrians, dt);
  }
  if (state.mode !== 'menu') updateCamera(dt);
  renderer.render(scene, camera);
}

showMenu();
if (SHOT) setupShot(SHOT);
tick();
