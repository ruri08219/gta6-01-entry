// Tiny synthesized sound: WebAudio beeps and blips only, no audio files.
// Everything is guarded so a browser without audio (or a muted tab) never breaks play.
export function createAudio() {
  let ctx = null;
  let enabled = true;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.05, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch {
      // Sound is garnish: never let it stop the game.
    }
  }

  return {
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },
    click() { tone(660, 0.06, 'square', 0.04); },
    punch() { tone(140, 0.09, 'sawtooth', 0.07, 70); },
    coin() { tone(880, 0.08, 'sine', 0.06); tone(1320, 0.14, 'sine', 0.05); },
    mission() { tone(523, 0.12, 'triangle', 0.07); setTimeout(() => tone(784, 0.18, 'triangle', 0.07), 120); },
    busted() { tone(392, 0.25, 'sawtooth', 0.07, 196); setTimeout(() => tone(196, 0.4, 'sawtooth', 0.07), 220); },
    siren() { tone(700, 0.28, 'sine', 0.035, 1100); },
    horn() { tone(220, 0.18, 'square', 0.05); },
    engineStart() { tone(90, 0.25, 'sawtooth', 0.05, 180); },
    engine(on) {
      if (!enabled) return;
      const c = ensure();
      if (!c) return;
      try {
        if (on && !engineOsc) {
          engineOsc = c.createOscillator();
          engineGain = c.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 55;
          engineGain.gain.value = 0.018;
          engineOsc.connect(engineGain);
          engineGain.connect(c.destination);
          engineOsc.start();
        } else if (!on && engineOsc) {
          engineOsc.stop();
          engineOsc = null;
          engineGain = null;
        }
      } catch {
        engineOsc = null;
      }
    },
    enginePitch(speed01) {
      if (engineOsc) {
        try { engineOsc.frequency.value = 55 + speed01 * 90; } catch { /* ignore */ }
      }
    },
  };
}
