// Vice Shores boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over. A saved game resumes its mission and cash.
//
// ?seed=N fixes the traffic, the city and every shot. ?shot=start|play|chase|
// mission (with &seed=N) stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_ATTACK, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Read-only handle for automated play-tests (screenshots and local checks).
window.__viceShores = { world };


function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let saved = world.loadSave();
  let best = saved ? saved.missionsDone : 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    if (saved) {
      world.applySave(saved);
      saved = null;
    } else {
      world.reset();
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Vice Shores. Follow the mission marker.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    best = world.state.stats.missionsDone;
    announce(`Busted. Cash kept $${world.state.cash}. Missions done ${best}.`);
  }

  function controlsFromInput() {
    const dir = input.direction();
    const actions = input.takeActions();
    return {
      mx: dir.x,
      my: dir.y,
      up: input.up,
      down: input.down,
      left: input.left,
      right: input.right,
      run: input.run,
      enter: Boolean(actions & ACTION_ENTER),
      attack: Boolean(actions & ACTION_ATTACK),
      actions,
    };
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(controls) {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the title.
      world.step(STEP, { mx: 0, my: 0, up: false, down: false, left: false, right: false, run: false, enter: false, attack: false }, audio);
      return;
    }
    world.step(STEP, controls, audio);
    if (world.state.gameOver) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let controls = controlsFromInput();
    handleActions(controls.actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(controls);
        accumulator -= STEP;
        // One-shot actions (enter, attack) fire on the first step only: a slow
        // frame that replays several steps must not enter and exit in one go.
        controls = { ...controls, enter: false, attack: false, actions: 0 };
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // M mutes the synth; the game never needs a network request for sound.
  window.addEventListener('keydown', (event) => {
    if (event.key === 'm' || event.key === 'M') {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
  });

  announce('Vice Shores. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
