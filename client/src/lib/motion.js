/* True when the visitor asked the OS for less motion. Read at call time, so a
   component can decide before it starts an animation. */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
