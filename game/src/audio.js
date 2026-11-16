// All sound is synthesised with WebAudio: no audio files, no network.
// The context is created on the first user gesture; every call before
// that is a harmless no-op. A tiny step sequencer plays the music loop.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let unlocked = false;
  let musicOn = true;
  let nextStepTime = 0;
  let step = 0;

  /** A minor-key bass line, one step per eighth note at 112 BPM. */
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];
  const STEP_SECONDS = 60 / 112 / 2;

  function unlock() {
    if (unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      unlocked = true;
      nextStepTime = ctx.currentTime + 0.1;
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // No audio on this machine: the game stays silent, never crashes.
    }
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!ctx || !master || !noiseBuffer) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function musicStep() {
    if (!ctx || !musicGain || !musicOn) return;
    while (nextStepTime < ctx.currentTime + 0.15) {
      const bass = BASS[step % BASS.length];
      if (bass > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bass;
        gain.gain.setValueAtTime(0.5, nextStepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextStepTime + STEP_SECONDS * 0.95);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(nextStepTime);
        osc.stop(nextStepTime + STEP_SECONDS);
      }
      if (step % 8 === 6) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, nextStepTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextStepTime + 0.3);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(nextStepTime);
        osc.stop(nextStepTime + 0.32);
      }
      nextStepTime += STEP_SECONDS;
      step += 1;
    }
  }

  return {
    unlock,
    update() {
      if (unlocked) musicStep();
    },
    toggleMusic() {
      musicOn = !musicOn;
      return musicOn;
    },
    shoot() {
      tone(920, 0.07, 'square', 0.08, 420);
    },
    hit() {
      noise(0.08, 0.14, 1800);
    },
    kill() {
      tone(300, 0.16, 'square', 0.12, 70);
      noise(0.14, 0.16, 1200);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.18, 60);
      noise(0.2, 0.2, 900);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.16);
      tone(990, 0.14, 'sine', 0.16, 0, 0.08);
    },
    wave() {
      tone(220, 0.3, 'triangle', 0.16);
      tone(277.18, 0.3, 'triangle', 0.14, 0, 0.02);
      tone(329.63, 0.34, 'triangle', 0.14, 0, 0.04);
    },
    upgrade() {
      tone(523.25, 0.12, 'sine', 0.16);
      tone(659.25, 0.12, 'sine', 0.16, 0, 0.09);
      tone(783.99, 0.2, 'sine', 0.16, 0, 0.18);
    },
    over() {
      tone(392, 0.3, 'sawtooth', 0.14, 370);
      tone(311.13, 0.3, 'sawtooth', 0.14, 294, 0.28);
      tone(233.08, 0.6, 'sawtooth', 0.14, 220, 0.56);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.24, 'triangle', 0.16, 0, i * 0.12));
    },
  };
}
