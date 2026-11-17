// The deterministic screenshot scenes behind ?shot=start|play|chase|mission.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, steered by a small scripted driver, so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './entities.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// A fake keyboard: the staged scenes drive with this instead of real keys.
function scriptedInput(moves) {
  let frame = 0;
  return {
    move() {
      let m = moves[Math.min(frame, moves.length - 1)] || { x: 0, y: 0 };
      if (typeof m === 'function') m = m();
      return { x: m.x || 0, y: m.y || 0 };
    },
    throttle() {
      const m = moves[Math.min(frame, moves.length - 1)] || {};
      return !!m.throttle;
    },
    brake() {
      const m = moves[Math.min(frame, moves.length - 1)] || {};
      return !!m.brake;
    },
    steer() {
      const m = moves[Math.min(frame, moves.length - 1)] || {};
      return m.steer || 0;
    },
    tick() { frame += 1; },
  };
}

function driveScript(seconds, steerWave) {
  const moves = [];
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    moves.push({ throttle: true, steer: Math.sin(i * 0.02) * steerWave });
  }
  return moves;
}

function walkToward(game, tx, ty, seconds) {
  const moves = [];
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    moves.push(() => {
      const p = game.state.player;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 30) return { x: 0, y: 0 };
      return { x: dx / d, y: dy / d };
    });
  }
  return moves;
}

function runSteps(game, input, seconds, actions) {
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    game.step(STEP, input, actions || {});
    if (input.tick) input.tick();
  }
}

// Put Rook beside a parked car and get in, the way a player would.
function getInCar(game) {
  const car = game.state.cars.find((c) => c.owner === 'parked');
  if (!car) return;
  game.state.player.x = car.x - 30;
  game.state.player.y = car.y;
  const idle = scriptedInput([]);
  game.step(STEP, idle, { enter: true });
}

export function stageShot(name, game) {
  game.reset(true);
  const idle = scriptedInput([]);
  if (name === 'play') {
    runSteps(game, idle, 1, { confirm: true });
    getInCar(game);
    runSteps(game, scriptedInput(driveScript(9, 0.25)), 9, {});
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    runSteps(game, idle, 1, { confirm: true });
    getInCar(game);
    game.state.wanted = 3.2;
    game.state.crimeTimer = 0;
    runSteps(game, scriptedInput(driveScript(7, 0.4)), 7, {});
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    runSteps(game, idle, 1, { confirm: true });
    const market = game.state.city.market;
    game.state.player.x = market.x - 260;
    game.state.player.y = market.y + 40;
    runSteps(game, scriptedInput(walkToward(game, market.x, market.y, 4)), 4, {});
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    runSteps(game, idle, 1, { confirm: true });
    getInCar(game);
    game.state.wanted = 5;
    game.state.player.health = 12;
    runSteps(game, scriptedInput(driveScript(6, 0.5)), 6, {});
    return { screen: game.state.gameOver ? SCREEN_OVER : SCREEN_PLAY };
  }
  // Default: the title screen over a living city.
  runSteps(game, idle, 5, {});
  return { screen: SCREEN_TITLE };
}
