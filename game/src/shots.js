// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot that walks or drives the road grid toward its goal, so the
// frame is what a short game really looks like and the same seed always gives
// the same frame.

import { ROADS_H, ROADS_V, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const CHASE_SECONDS = 14;
const MISSION_SECONDS = 5;

/** Silent stand-in for the audio synth: screenshots need no sound. */
const SILENT = {
  click() {}, pickup() {}, cash() {}, hit() {}, punch() {},
  siren() {}, mission() {}, fail() {}, engine() {},
};

function nearest(list, value) {
  let best = list[0];
  for (const v of list) if (Math.abs(v - value) < Math.abs(best - value)) best = v;
  return best;
}

/** Road-grid route: avenue, then street, then avenue again, then the goal. */
function routeWaypoints(fromX, fromY, toX, toY) {
  const v1 = nearest(ROADS_V, fromX);
  const h = nearest(ROADS_H, toY);
  const v2 = nearest(ROADS_V, toX);
  const raw = [
    { x: v1, y: fromY },
    { x: v1, y: h },
    { x: v2, y: h },
    { x: toX, y: toY },
  ];
  const out = [];
  for (const wp of raw) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(wp.x - last.x, wp.y - last.y) > 30) out.push(wp);
  }
  return out;
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makePilot(world) {
  let waypoints = [];
  let enteredCar = false;

  function refreshWaypoints(toX, toY) {
    const p = world.state.player;
    waypoints = routeWaypoints(p.x, p.y, toX, toY);
  }

  function steerTo(target, controls) {
    const p = world.state.player;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d < 46) {
      waypoints.shift();
      return;
    }
    if (p.inCar !== null) {
      const car = world.state.cars.find((c) => c.id === p.inCar);
      const speed = car ? Math.abs(car.speed) : 0;
      const want = Math.atan2(target.y - p.y, target.x - p.x);
      const diff = angleDiff(p.angle, want);
      controls.left = diff < -0.12;
      controls.right = diff > 0.12;
      // Creep while slow even when misaligned: steering needs motion to bite.
      controls.up = Math.abs(diff) < 0.9 || speed < 100;
      controls.down = Math.abs(diff) > 2.2 && speed > 100;
    } else {
      const mx = (target.x - p.x) / d;
      const my = (target.y - p.y) / d;
      controls.mx = mx;
      controls.my = my;
      controls.run = d > 300;
    }
  }

  return {
    /** Walk the road grid toward a point. */
    walkTo(toX, toY) {
      const p = world.state.player;
      if (waypoints.length === 0) refreshWaypoints(toX, toY);
      const controls = { mx: 0, my: 0, up: false, down: false, left: false, right: false, run: false, enter: false, attack: false };
      if (waypoints.length > 0) steerTo(waypoints[0], controls);
      return controls;
    },
    /** Get into the nearest parked car, then drive the road grid toward a point. */
    driveTo(toX, toY) {
      const p = world.state.player;
      const controls = { mx: 0, my: 0, up: false, down: false, left: false, right: false, run: false, enter: false, attack: false };
      if (p.inCar === null && !enteredCar) {
        let best = null;
        let bestD = Infinity;
        for (const car of world.state.cars) {
          if (car.kind !== 'parked') continue;
          const d = Math.hypot(car.x - p.x, car.y - p.y);
          if (d < bestD) { bestD = d; best = car; }
        }
        if (best) {
          if (bestD < 78) {
            controls.enter = true;
            enteredCar = true;
            return controls;
          }
          return this.walkTo(best.x, best.y);
        }
      }
      if (waypoints.length === 0) refreshWaypoints(toX, toY);
      if (waypoints.length > 0) steerTo(waypoints[0], controls);
      return controls;
    },
  };
}

function runSteps(world, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, drive(world.state), SILENT);
    if (world.state.gameOver) break;
  }
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other name
 * is start) and return the screen to draw over it and the saved progress to show.
 */
export function stageShot(name, world) {
  world.reset();
  const pilot = makePilot(world);
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, up: false, down: false, left: false, right: false, run: false, enter: false, attack: false }, SILENT);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  const target = world.missionTarget();
  if (name === 'play') {
    runSteps(world, PLAY_SECONDS, () => pilot.walkTo(target.x, target.y));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    world.addWanted(3, SILENT);
    runSteps(world, CHASE_SECONDS, () => pilot.driveTo(target.x, target.y));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  runSteps(world, MISSION_SECONDS, () => pilot.driveTo(target.x, target.y));
  return { screen: SCREEN_PLAY, best: 0 };
}
