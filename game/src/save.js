// Save / load through localStorage. Plain JSON, one key, no network.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      debtPaid: state.debtPaid,
      missionIndex: state.missionIndex,
      completedMissions: state.completedMissions,
      player: { x: state.player.pos.x, z: state.player.pos.z },
      health: state.player.health,
      wanted: 0,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
