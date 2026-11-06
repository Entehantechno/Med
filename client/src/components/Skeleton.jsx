/* Shimmer skeleton placeholders (motion-UI loading). */
export function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid grid-3">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card" key={i}>
          <div className="skeleton sk-card" />
          <div className="skeleton sk-line" style={{ width: "70%", marginTop: 14 }} />
          <div className="skeleton sk-line" style={{ width: "45%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="card">
      <div className="skeleton sk-line" style={{ width: "30%", height: 18, marginBottom: 16 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton sk-line" key={i} style={{ height: 34, margin: "10px 0" }} />
      ))}
    </div>
  );
}

/* R89: first-paint placeholder for a returning, signed-in visitor while /auth/me is in flight.
   Same top bar and content frame as the signed-in home, so the page does not go blank and then
   jump. It is deliberately STATIC (no shimmer animation): a running animation kept the main thread
   busy while the app bundle was still being parsed (measured: +0.4 s content time on Slow 4G).
   role="status" + aria-busy keep it announced to screen readers. Styles: app-boot.css. */
export function AppBootSkeleton() {
  return (
    <div className="app-boot-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="abs-block abs-bar" />
      <div className="abs-body">
        <div className="abs-block abs-title" />
        <div className="abs-block abs-sub" />
        <div className="abs-cards">
          <div className="abs-block abs-card" />
          <div className="abs-block abs-card" />
          <div className="abs-block abs-card" />
        </div>
      </div>
    </div>
  );
}
