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
