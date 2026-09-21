/* feedback.js — multisensory micro-feedback for lessons (sound + haptics).

   Research (Duolingo / Cognitive Load Theory): pairing visual feedback with a
   short sound + a light haptic increases lesson-completion and retention, as
   long as it's subtle, instant, and mutable. We synthesize tones with the Web
   Audio API — ZERO audio files, works offline, tiny footprint. Everything is
   AI-free and respects a user mute toggle (localStorage) and the reduced-motion
   preference (we still allow sound, but never force it).

   Public API:
     isSoundOn(), setSoundOn(bool)
     playCorrect(), playWrong(), playComplete(), playTap()
     -- richer celebration effects (this pass) --
     playLevelUp()     — triumphant ascending fanfare for a tier promotion
     playStreak()      — warm bell + shimmer for a streak milestone
     playAchievement() — sparkly two-bell chime for an unlocked achievement
     playFanfare()     — grand multi-note fanfare (checkpoint / legendary pass)
     celebrate(kind)   — convenience dispatcher: "levelup"|"streak"|"achievement"|"fanfare"|"complete"
     buzz(pattern)  — navigator.vibrate wrapper (mobile only, best-effort)
*/

const KEY = "medlab_sound";

export function isSoundOn() {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* */ }
}

let _ctx = null;
function ctx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) { try { _ctx = new AC(); } catch { return null; } }
  // browsers suspend audio until a user gesture; resume opportunistically
  if (_ctx.state === "suspended") { _ctx.resume().catch(() => {}); }
  return _ctx;
}

/* Play a short tone. freq in Hz, dur in seconds, type = wave shape, gain 0..1. */
function tone(freq, start, dur, { type = "sine", gain = 0.14 } = {}) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  // quick attack + smooth exponential release (pleasant, not clicky)
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(ac.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

/* Light haptic (mobile only). pattern is ms or an array of ms. */
export function buzz(pattern = 12) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* */ }
}

/* A cheerful rising two-note "ding" for a correct answer. */
export function playCorrect() {
  if (!isSoundOn()) return;
  tone(660, 0, 0.12, { type: "triangle", gain: 0.13 });
  tone(880, 0.09, 0.16, { type: "triangle", gain: 0.13 });
  buzz(10);
}

/* A soft, non-alarming low "thunk" for a wrong answer (firm, not harsh). */
export function playWrong() {
  if (!isSoundOn()) return;
  tone(200, 0, 0.16, { type: "sine", gain: 0.12 });
  tone(150, 0.08, 0.18, { type: "sine", gain: 0.1 });
  buzz([12, 40, 12]);
}

/* A short triumphant arpeggio for finishing a lesson. */
export function playComplete() {
  if (!isSoundOn()) return;
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((f, i) => tone(f, i * 0.11, 0.22, { type: "triangle", gain: 0.14 }));
  buzz([15, 30, 15]);
}

/* A tiny tick for a selection tap (very subtle). */
export function playTap() {
  if (!isSoundOn()) return;
  tone(420, 0, 0.05, { type: "sine", gain: 0.05 });
}

/* ======================================================================
   Richer celebration effects.
   Still 100% synthesized (no audio files), still gated by the mute toggle,
   still ZERO cost. Kept short (< ~1s) and gentle so they delight without
   annoying. Each layers a couple of voices for a fuller, "produced" feel.
   ====================================================================== */

/* A soft supporting chord under a lead note — adds warmth/body. */
function chord(freqs, start, dur, { type = "sine", gain = 0.05 } = {}) {
  freqs.forEach((f) => tone(f, start, dur, { type, gain }));
}

/* A short sparkle: a few quick high partials that shimmer upward. */
function sparkle(start, { gain = 0.05 } = {}) {
  [1568, 2093, 2637].forEach((f, i) =>
    tone(f, start + i * 0.05, 0.14, { type: "triangle", gain: gain * (1 - i * 0.2) })
  );
}

/* LEVEL-UP: a rising major fanfare (C–E–G–C–E) with a warm chord bed and a
   sparkle tail. Used when a learner is promoted to a new tier. */
export function playLevelUp() {
  if (!isSoundOn()) return;
  const lead = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
  lead.forEach((f, i) => tone(f, i * 0.1, 0.24, { type: "triangle", gain: 0.14 }));
  chord([261.63, 329.63, 392.0], 0.0, 0.6, { type: "sine", gain: 0.05 });   // C major bed
  chord([392.0, 523.25, 659.25], 0.42, 0.55, { type: "sine", gain: 0.05 }); // G bed lift
  sparkle(0.5, { gain: 0.06 });
  buzz([18, 40, 18, 40, 26]);
}

/* STREAK MILESTONE: a warm bell strike + gentle upward shimmer (fire vibe). */
export function playStreak() {
  if (!isSoundOn()) return;
  tone(587.33, 0, 0.5, { type: "sine", gain: 0.13 });     // D5 bell body
  tone(880, 0.02, 0.32, { type: "triangle", gain: 0.08 });// bright partial
  tone(1174.66, 0.1, 0.28, { type: "sine", gain: 0.05 }); // octave shimmer
  sparkle(0.16, { gain: 0.045 });
  buzz([14, 26, 14]);
}

/* ACHIEVEMENT UNLOCKED: a bright two-bell "ta-da" with a sparkle. */
export function playAchievement() {
  if (!isSoundOn()) return;
  tone(659.25, 0, 0.2, { type: "triangle", gain: 0.13 });  // E5
  tone(987.77, 0.12, 0.34, { type: "triangle", gain: 0.13 }); // B5
  chord([329.63, 493.88], 0.0, 0.4, { type: "sine", gain: 0.05 });
  sparkle(0.22, { gain: 0.055 });
  buzz([16, 30, 22]);
}

/* GRAND FANFARE: a fuller triumphant flourish for passing a Checkpoint or a
   Legendary challenge — the biggest positive moment in the app. */
export function playFanfare() {
  if (!isSoundOn()) return;
  const lead = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4 C5 E5 G5 C6
  lead.forEach((f, i) => tone(f, i * 0.09, 0.26, { type: "triangle", gain: 0.15 }));
  // final held major chord for a satisfying resolution
  chord([523.25, 659.25, 783.99, 1046.5], 0.42, 0.7, { type: "sine", gain: 0.06 });
  sparkle(0.52, { gain: 0.06 });
  buzz([20, 40, 20, 40, 20, 40, 30]);
}

/* ======================================================================
   Mascot poke sounds — short, playful "boop" effects for tapping the path
   characters (Dr. Med + the Microbe). Still 100% synthesized, gated by the
   mute toggle, zero-cost. Kept tiny (<0.4s) so repeated taps feel snappy and
   never annoying.
   ====================================================================== */

/* DR. MED "boop-hop" — a cheerful quick rising blip, like a friendly bounce. */
export function playDrMedPoke() {
  if (!isSoundOn()) return;
  // a springy two-step upward chirp that mirrors the jump animation
  tone(523.25, 0, 0.09, { type: "triangle", gain: 0.11 });  // C5
  tone(783.99, 0.07, 0.12, { type: "triangle", gain: 0.12 }); // G5 — the "hop"
  tone(1046.5, 0.15, 0.10, { type: "sine", gain: 0.06 });     // C6 sparkle top
  buzz(10);
}

/* MICROBE "wobble-giggle" — a silly, wobbly descending blorp with a quick
   vibrato so it reads as a mischievous little creature being squished. */
export function playMicrobePoke() {
  if (!isSoundOn()) return;
  const ac = ctx();
  if (!ac) { buzz([10, 30, 10]); return; }
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sawtooth";
  // a downward "boing" from ~500 to ~260 Hz with a fast wobble on top
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(260, t0 + 0.24);
  const lfo = ac.createOscillator();      // vibrato = the "giggle" wobble
  const lfoGain = ac.createGain();
  lfo.frequency.setValueAtTime(22, t0);
  lfoGain.gain.setValueAtTime(35, t0);
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  osc.connect(g); g.connect(ac.destination);
  osc.start(t0); lfo.start(t0);
  osc.stop(t0 + 0.3); lfo.stop(t0 + 0.3);
  buzz([10, 30, 10]);
}

/* Convenience dispatcher so callers can pick the right effect by name and we
   keep a single source of truth. Falls back to the completion arpeggio. */
export function celebrate(kind = "complete") {
  switch (kind) {
    case "levelup":     return playLevelUp();
    case "streak":      return playStreak();
    case "achievement": return playAchievement();
    case "fanfare":     return playFanfare();
    case "complete":
    default:            return playComplete();
  }
}
