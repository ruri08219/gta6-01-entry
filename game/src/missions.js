// Missions + story: a 6-mission arc paying down Rico's $50,000 debt to
// fixer Delia Cross. Each mission tracks its own progress and rewards.
import { MISSIONS, DEBT_TOTAL } from './config.js';
import { makeBeacon } from './world.js';

export class MissionRunner {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;                 // current mission
    this.completed = [];            // finished mission ids
    this.stage = 0;                 // per-mission sub-stage
    this.defeated = 0;
    this.delivered = 0;
    this.beacon = null;
    this.cashStolen = false;
  }

  get current() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  // (Re)build the beacon for the current objective.
  placeBeacon() {
    this.clearBeacon();
    const m = this.current;
    if (!m) return;
    let target = null;
    if (m.type === 'deliver') target = m.targets[this.delivered];
    else if (m.type === 'heist') target = this.stage === 1 ? m.escape : m.target;
    else target = m.target;
    if (!target) return;
    this.beacon = makeBeacon(this.scene, 0xffc93d);
    this.beacon.position.set(target.x, 0, target.z);
    this.beaconTarget = target;
  }

  clearBeacon() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
  }

  startMission(i) {
    this.index = i;
    this.stage = 0;
    this.defeated = 0;
    this.delivered = 0;
    this.cashStolen = false;
    this.placeBeacon();
  }

  // Called every frame; returns an event string when something happens.
  update(state) {
    const m = this.current;
    if (!m) return null;
    const p = state.player.pos;
    const near = (t, r) => t && Math.hypot(p.x - t.x, p.z - t.z) < (r || 7);

    if (m.type === 'steal') {
      if (state.player.car) return this.completeMission(state, 'Car stolen — Delia is pleased.');
      return null;
    }
    if (m.type === 'deliver') {
      const t = m.targets[this.delivered];
      if (near(t, 8)) {
        this.delivered += 1;
        state.sound.pickup();
        if (this.delivered >= m.targets.length) return this.completeMission(state, 'Both packages delivered.');
        this.placeBeacon();
        return 'Package delivered — ' + (m.targets.length - this.delivered) + ' to go.';
      }
      return null;
    }
    if (m.type === 'defeat') {
      if (this.defeated >= m.count) return this.completeMission(state, 'Crew dealt with.');
      return null;
    }
    if (m.type === 'escape') {
      if (this.stage === 0 && state.wanted.level >= 2) {
        this.stage = 1;
        return 'Heat is on! Now lose the cops and reach the hideout.';
      }
      if (this.stage === 1 && state.wanted.level === 0 && near(m.target, 9)) {
        return this.completeMission(state, 'Clean getaway — the heat is off.');
      }
      return null;
    }
    if (m.type === 'heist') {
      if (this.stage === 0 && near(m.target, 8)) {
        this.stage = 1;
        this.cashStolen = true;
        state.sound.pickup();
        state.wanted.setLevel(3);
        this.placeBeacon();
        return 'Vault cash grabbed! 3 stars — get to the hideout!';
      }
      if (this.stage === 1 && state.wanted.level === 0 && near(m.escape, 9)) {
        return this.completeMission(state, 'Vault job done — $1,000 closer to freedom.');
      }
      return null;
    }
    return null;
  }

  completeMission(state, message) {
    const m = this.current;
    this.completed.push(m.id);
    state.cash += m.reward;
    state.debtPaid += m.reward;
    state.sound.missionDone();
    this.clearBeacon();
    this.index += 1;
    this.stage = 0;
    this.defeated = 0;
    this.delivered = 0;
    if (this.current) this.placeBeacon();
    return 'MISSION COMPLETE: ' + m.title + '  +$' + m.reward + ' — ' + message;
  }

  objectiveText() {
    const m = this.current;
    if (!m) return 'All missions complete — Solara Bay is yours, Rico.';
    let extra = '';
    if (m.type === 'defeat') extra = '  (' + this.defeated + '/' + m.count + ')';
    if (m.type === 'deliver') extra = '  (' + this.delivered + '/' + m.targets.length + ')';
    if (m.type === 'escape' && this.stage === 1) extra = '  (lose the heat, then reach the hideout)';
    if (m.type === 'heist' && this.stage === 1) extra = '  (escape to the hideout!)';
    return m.title + ': ' + m.objective + extra;
  }

  debtLeft() { return Math.max(0, DEBT_TOTAL - this.debtPaid); }
}
