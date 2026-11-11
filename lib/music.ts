// Backing tracks for the dances. Synthesized like every other sound in the game
// (no audio files): a two-bar loop of drums, bass and a little lead, scheduled
// a beat or so ahead on the audio clock so it stays in time however busy the
// frame is.
//
// Four styles, one per kind of dance — see `DANCES` in lib/danceInfo.ts for
// which dance gets which.

import { ensureAudio } from "./audio";

export type MusicStyle = "funk" | "break" | "latin" | "party";

interface Track {
  bpm: number;
  /** Sixteen steps a bar, two bars. Each string is 32 characters; "x" plays. */
  kick: string;
  snare: string;
  hat: string;
  /** Bass and lead notes per step, as semitones above A1 / A3; null rests. */
  bass: (number | null)[];
  lead: (number | null)[];
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  /** A clave or cowbell on top, for the styles that have one. */
  click?: string;
}

const _ = null;

const TRACKS: Record<MusicStyle, Track> = {
  // Mid-tempo funk: four on the floor, a bass that walks, a stabby lead.
  funk: {
    bpm: 116,
    kick: "x...x...x...x...x...x...x...x.x.",
    snare: "....x.......x.......x.......x...",
    hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.",
    bass: [0, _, _, 0, _, _, 12, _, 10, _, 7, _, 5, _, 3, _, 0, _, _, 0, _, _, 12, _, 15, _, 12, _, 10, 7, 5, 3],
    lead: [_, _, 12, _, _, 15, _, _, _, _, 17, _, 15, _, _, _, _, _, 12, _, _, 15, _, _, 19, _, 17, _, 15, _, 12, _],
    bassWave: "square",
    leadWave: "sawtooth",
  },
  // Boom-bap: lazy, swung, heavy on the kick. What a cow spins on its head to.
  break: {
    bpm: 92,
    kick: "x.....x...x.....x.....x..x......",
    snare: "....x.......x.......x.......x..x",
    hat: "x.xxx.x.x.xxx.x.x.xxx.x.x.xxx.xx",
    bass: [0, _, _, _, _, _, 0, _, _, _, 3, _, _, _, _, _, 5, _, _, _, _, _, 5, _, 3, _, _, _, _, _, _, _],
    lead: [_, _, _, _, _, _, _, _, 24, _, _, 22, _, _, _, _, _, _, _, _, _, _, _, _, 22, _, 19, _, _, _, _, _],
    bassWave: "triangle",
    leadWave: "square",
  },
  // A slow, smoky rumba: clave, a soft bass and a melody that thinks it is
  // much more romantic than it is.
  latin: {
    bpm: 98,
    kick: "x.......x.......x.......x.......",
    snare: "......x.......x.......x.......x.",
    hat: "..x...x...x...x...x...x...x...x.",
    click: "x..x..x...x.x...x..x..x...x.x...",
    bass: [0, _, _, 7, _, _, 12, _, 0, _, _, 7, _, _, 12, _, 5, _, _, 12, _, _, 17, _, 7, _, _, 14, _, _, 19, _],
    lead: [12, _, _, _, 15, _, 14, _, 12, _, _, _, _, _, _, _, 17, _, _, _, 15, _, 14, _, 15, _, _, _, _, _, _, _],
    bassWave: "sine",
    leadWave: "triangle",
  },
  // Oom-pah party: bouncy, major key, cowbell. For the chicken dance and friends.
  party: {
    bpm: 128,
    kick: "x...x...x...x...x...x...x...x...",
    snare: "..x...x...x...x...x...x...x...x.",
    hat: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    click: "x.......x.......x.......x...x.x.",
    bass: [3, _, _, _, 10, _, _, _, 3, _, _, _, 10, _, _, _, 8, _, _, _, 15, _, _, _, 10, _, _, _, 5, _, 7, _],
    lead: [15, _, 15, _, 19, _, 22, _, 19, _, 15, _, _, _, _, _, 20, _, 20, _, 24, _, 20, _, 22, _, 19, _, _, _, _, _],
    bassWave: "square",
    leadWave: "square",
  },
};

let playing: { style: MusicStyle; stop: () => void } | null = null;

export function musicStyle(): MusicStyle | null {
  return playing?.style ?? null;
}

/** Start a style looping (or keep it going if it already is). */
export function startMusic(style: MusicStyle) {
  if (playing?.style === style) return;
  stopMusic();
  const c = ensureAudio();
  const track = TRACKS[style];
  const out = c.createGain();
  out.gain.setValueAtTime(0, c.currentTime);
  out.gain.linearRampToValueAtTime(0.32, c.currentTime + 0.4);
  out.connect(c.destination);

  const stepLen = 60 / track.bpm / 4;
  let step = 0;
  let next = c.currentTime + 0.08;
  const timer = setInterval(() => {
    // schedule everything that falls in the next 200 ms
    while (next < c.currentTime + 0.2) {
      const i = step % 32;
      // a touch of swing on the off-beats, more for the boom-bap
      const swing = i % 2 === 1 ? stepLen * (style === "break" ? 0.18 : 0.08) : 0;
      const t = next + swing;
      if (track.kick[i] === "x") kick(c, out, t);
      if (track.snare[i] === "x") snare(c, out, t);
      if (track.hat[i] === "x") hat(c, out, t, i % 4 === 2 ? 0.07 : 0.04);
      if (track.click?.[i] === "x") click(c, out, t, style === "party");
      const b = track.bass[i];
      if (b !== null) tone(c, out, t, 55 * 2 ** (b / 12), stepLen * 1.8, track.bassWave, 0.22);
      const l = track.lead[i];
      if (l !== null) tone(c, out, t, 220 * 2 ** (l / 12), stepLen * 1.6, track.leadWave, 0.07);
      step++;
      next += stepLen;
    }
  }, 50);

  playing = {
    style,
    stop: () => {
      clearInterval(timer);
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.35);
      setTimeout(() => out.disconnect(), 500);
    },
  };
}

export function stopMusic() {
  playing?.stop();
  playing = null;
}

// ---------------------------------------------------------------------------
// the instruments
// ---------------------------------------------------------------------------

function kick(c: AudioContext, out: AudioNode, t: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.24);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBufferSourceNode {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const n = c.createBufferSource();
  n.buffer = noiseBuf;
  return n;
}

function snare(c: AudioContext, out: AudioNode, t: number) {
  const n = noise(c);
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.18);
}

function hat(c: AudioContext, out: AudioNode, t: number, vol: number) {
  const n = noise(c);
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.05);
}

/** A wood-block clave, or — for the party track — a cowbell. Obviously. */
function click(c: AudioContext, out: AudioNode, t: number, cowbell: boolean) {
  const g = c.createGain();
  g.gain.setValueAtTime(cowbell ? 0.12 : 0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (cowbell ? 0.18 : 0.06));
  g.connect(out);
  for (const f of cowbell ? [540, 800] : [2300]) {
    const o = c.createOscillator();
    o.type = cowbell ? "square" : "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.2);
  }
}

function tone(c: AudioContext, out: AudioNode, t: number, freq: number, len: number, wave: OscillatorType, vol: number) {
  const o = c.createOscillator();
  o.type = wave;
  o.frequency.value = freq;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = wave === "sine" || wave === "triangle" ? 4000 : 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.02);
}

// Dev only: `__music()` says which track is playing.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __music?: () => MusicStyle | null }).__music = musicStyle;
}
