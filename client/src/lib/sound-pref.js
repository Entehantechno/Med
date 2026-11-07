/* sound-pref.js — the mute toggle, kept apart from the audio engine (feedback.js)
   so the always-loaded app shell does not ship the Web Audio code. */
const KEY = "medlab_sound";

export function isSoundOn() {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* */ }
}
