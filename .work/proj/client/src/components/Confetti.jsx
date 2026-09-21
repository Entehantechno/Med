import { useEffect, useRef } from "react";

/* Dependency-free canvas confetti burst (full-screen, auto-stops).
   Runs a celebratory shower for ~`duration` ms then fades out. */
export default function Confetti({ duration = 3500, pieces = 160 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const colors = ["#f5b301", "#2f7fd1", "#22a06b", "#e0568a", "#7d6be0", "#ffd166", "#ff6470"];
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);

    const parts = Array.from({ length: pieces }).map(() => ({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.5,
      r: 5 + Math.random() * 7,
      c: colors[(Math.random() * colors.length) | 0],
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      shape: Math.random() > 0.5 ? "rect" : "circ",
    }));

    const start = Date.now();
    let raf;
    const tick = () => {
      const elapsed = Date.now() - start;
      const fade = elapsed > duration - 700 ? Math.max(0, (duration - elapsed) / 700) : 1;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.rot += p.vr;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; p.vy = 2 + Math.random() * 4; }
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        if (p.shape === "rect") ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      if (elapsed < duration) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [duration, pieces]);

  return <canvas ref={ref} style={{
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 300,
  }} />;
}
