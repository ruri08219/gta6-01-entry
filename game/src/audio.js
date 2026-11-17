// Tiny WebAudio synth: no audio files, just short oscillator blips for the
// pickup chime, the hit thud, the siren, the mission fanfare and the engine tick.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext ?? window.webkitAudioContext;
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = 0) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.05); },
    pickup() { tone(880, 0.09, 'sine', 0.09); tone(1320, 0.12, 'sine', 0.07, 0.08); },
    cash() { tone(988, 0.08, 'triangle', 0.09); tone(1319, 0.08, 'triangle', 0.09, 0.07); tone(1568, 0.14, 'triangle', 0.09, 0.14); },
    hit() { tone(140, 0.16, 'sawtooth', 0.12, 0, 70); },
    punch() { tone(220, 0.08, 'square', 0.1, 0, 110); },
    siren() { tone(700, 0.28, 'sine', 0.05, 0, 950); tone(950, 0.28, 'sine', 0.05, 0.28, 700); },
    mission() {
      tone(523, 0.12, 'triangle', 0.1);
      tone(659, 0.12, 'triangle', 0.1, 0.11);
      tone(784, 0.22, 'triangle', 0.11, 0.22);
    },
    fail() { tone(330, 0.2, 'sawtooth', 0.08, 0, 180); tone(220, 0.3, 'sawtooth', 0.08, 0.18, 110); },
    engine() { tone(90, 0.05, 'square', 0.025, 0, 120); },
  };
}
