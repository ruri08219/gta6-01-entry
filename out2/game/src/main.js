// Boot and the one loop for Vice Shores: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, play, paused and game over. Progress
// (cash, mission, health) is saved to localStorage and picked up next visit.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { createGame, EV_BUSTED, EV_COIN, EV_CRASH, EV_CRIME, EV_HORN, EV_MISSION, EV_STORY, SAVE_KEY, STEP } from './entities.js';
import { ACT_CONFIRM, ACT_ENTER, ACT_HORN, ACT_PAUSE, ACT_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { missionCount } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game.saveData()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function saveLabel() {
  const s = game.state;
  if (s.missionIndex >= missionCount()) return 'Story complete — free roam. M to mute sound.';
  return `Continuing from mission ${s.missionIndex + 1} of ${missionCount()} — $${s.cash} banked. M to mute sound.`;
}

function runShot(name) {
  const scene = stageShot(name, game);
  const target = game.missionTargetPos();
  let painted = 0;
  function paint() {
    renderer.draw(game.state, scene.screen, target, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let driving = false;

  const saved = readSave();
  if (saved) {
    game.loadData(saved);
    // loadData re-runs reset, which starts the saved mission's dialog.
  }

  function announce(message) {
    status.textContent = message;
  }

  function handleEvents() {
    for (const e of game.takeEvents()) {
      if (e === EV_COIN) audio.coin();
      else if (e === EV_PUNCH) audio.punch();
      else if (e === EV_CRASH) audio.punch();
      else if (e === EV_HORN) audio.horn();
      else if (e === EV_MISSION) {
        audio.mission();
        writeSave();
        announce(game.state.banner || 'Mission complete.');
      } else if (e === EV_STORY) {
        audio.mission();
        writeSave();
      } else if (e === EV_BUSTED) {
        audio.busted();
        audio.engine(false);
        announce('Busted. Game over.');
      } else if (e === 'siren') audio.siren();
    }
  }

  function startGame() {
    if (game.state.gameOver) {
      game.reset(true);
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    }
    screen = SCREEN_PLAY;
    accumulator = 0;
    announce('Playing. Follow the mission on the HUD.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const bits = input.takeActions();
    const actions = {
      enter: !!(bits & ACT_ENTER),
      punch: !!(bits & ACT_PUNCH),
      confirm: !!(bits & ACT_CONFIRM),
      horn: !!(bits & ACT_HORN),
    };

    if (bits & ACT_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions.confirm && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      actions.confirm = false; // one press starts; the next dismisses Marla's intro
    }
    else if (actions.confirm && screen === SCREEN_PAUSED) screen = SCREEN_PLAY;

    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        game.step(STEP, input, actions);
        actions.enter = false;
        actions.punch = false;
        actions.confirm = false;
        actions.horn = false;
        accumulator -= STEP;
        if (game.state.gameOver) {
          screen = SCREEN_OVER;
          break;
        }
      }
      handleEvents();
      saveTimer += 1 / 60;
      if (saveTimer > 10) {
        saveTimer = 0;
        writeSave();
      }
      const nowDriving = game.state.player.inCar !== null;
      if (nowDriving !== driving) {
        driving = nowDriving;
        audio.engine(driving);
        if (driving) audio.engineStart();
      }
      if (driving) {
        const car = game.playerCar();
        audio.enginePitch(car ? Math.min(1, Math.abs(car.speed) / 430) : 0);
      }
    } else {
      accumulator = 0;
      if (driving) {
        driving = false;
        audio.engine(false);
      }
      // Title / pause / game over: the world holds still behind the panel.
    }

    renderer.draw(game.state, screen, game.missionTargetPos(), screen === SCREEN_TITLE ? saveLabel() : null);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // M mutes the synthesized sound.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') audio.setEnabled(!audio.isEnabled());
  });

  announce('Vice Shores. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
