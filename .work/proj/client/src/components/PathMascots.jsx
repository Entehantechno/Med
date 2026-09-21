/* ============================================================================
   PathMascots — the MED School character cast: polished Pixar/Duolingo style 3D
   character ART (PNG, transparent bg, from client/public/mascots/ or an
   admin-uploaded /uploads/… image).

   Now LIVELY (Duolingo-style):
     • a gentle idle animation always plays (bob for Dr. Med, wobble for the
       Microbe) at an admin-controlled tempo (slow|normal|fast),
     • TAPPING a character triggers a one-shot playful reaction (Dr. Med jumps,
       the Microbe does a squishy shake),
     • all motion is disabled under prefers-reduced-motion (handled in CSS).

   The public API keeps `mood` + `size`; new optional props: `src` (image URL
   override) and `speed`. Images are decorative (aria-hidden). The tap handler
   lives on a <button> wrapper only when the character is interactive so it
   stays keyboard-free noise for screen readers (button has aria-hidden too).
   ========================================================================== */

import { useState, useCallback } from "react";
import { playDrMedPoke, playMicrobePoke } from "../lib/feedback.js";

/* Shared: an interactive character image that plays a one-shot "react"
   animation class on tap/click (plus a playful sound), then removes it so it
   can retrigger. `sound` is a function played on each poke. */
function LiveMascot({ base, src, size, width, mood, speed = "normal", extraStyle, reactClass, sound }) {
  const [reacting, setReacting] = useState(false);
  const poke = useCallback(() => {
    try { sound && sound(); } catch { /* audio is best-effort */ }
    setReacting(false);
    // next frame so the class truly re-applies on repeated taps
    requestAnimationFrame(() => requestAnimationFrame(() => setReacting(true)));
  }, [sound]);
  return (
    <button
      type="button"
      className={`mascot-btn ${reacting ? reactClass : ""}`}
      aria-hidden="true" tabIndex={-1}
      onClick={poke}
      onAnimationEnd={() => setReacting(false)}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}
    >
      <img
        className={`mascot mascot-img ${base} mascot-${mood} speed-${speed}`}
        src={src} alt="" aria-hidden="true"
        width={width} height={size} loading="lazy" draggable="false"
        style={{ display: "inline-block", objectFit: "contain", ...extraStyle }}
      />
    </button>
  );
}

export function DrMed({ size = 96, mood = "cheer", className = "", src = "/mascots/dr-med.webp", speed = "normal" }) {
  return (
    <LiveMascot
      base={`mascot-drmed ${className}`}
      src={src} size={size} width={Math.round(size * 0.62)}
      mood={mood} speed={speed} reactClass="react-jump" sound={playDrMedPoke}
    />
  );
}

export function Microbe({ size = 84, mood = "smirk", className = "", src = "/mascots/microbe.webp", speed = "normal" }) {
  const defeated = mood === "defeated";
  return (
    <LiveMascot
      base={`mascot-microbe ${className}`}
      src={src} size={size} width={size}
      mood={mood} speed={speed} reactClass="react-squish" sound={playMicrobePoke}
      extraStyle={{
        filter: defeated ? "grayscale(.55) brightness(.9)" : undefined,
        transform: defeated ? "rotate(-8deg)" : undefined,
        opacity: defeated ? 0.85 : 1,
      }}
    />
  );
}

/* A speech-bubble wrapper so a mascot can "say" a short line beside the path. */
export function MascotSay({ children, side = "start", className = "" }) {
  return (
    <div className={`mascot-say mascot-say-${side} ${className}`} role="note">
      <span className="mascot-say-bubble">{children}</span>
    </div>
  );
}
