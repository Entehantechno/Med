import { useApp } from "../context.jsx";

/* Dependency-free charts using inline SVG / CSS. */

// Bar chart: data = [{label, value}]
export function BarChart({ data, max = 100, unit = "" }) {
  const { t } = useApp();
  if (!data || !data.length) return <div className="small muted">{t("noData")}</div>;
  const top = Math.max(max, ...data.map((d) => d.value)) || 1;
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-val">{d.value}{unit}</div>
          <div className="bar" style={{ height: `${(d.value / top) * 100}%` }} title={`${d.label}: ${d.value}`} />
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// Line/sparkline via SVG: values = number[]
export function LineChart({ values, height = 130, color = "var(--primary)" }) {
  const { t } = useApp();
  if (!values || values.length < 2) return <div className="small muted">{t("noData")}</div>;
  const w = 100, h = height;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

// Donut for two-part split: parts = [{label,value,color}]
export function Donut({ parts, size = 140 }) {
  const { t } = useApp();
  const total = parts.reduce((a, b) => a + b.value, 0);
  if (!total) return <div className="small muted">{t("noData")}</div>;
  const r = 55, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--panel2)" strokeWidth="16" />
        {parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
              transform="rotate(-90 70 70)" strokeLinecap="butt" />
          );
          offset += len; return el;
        })}
        <text x="70" y="76" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--text)">{total}</text>
      </svg>
      <div className="legend">
        {parts.map((p, i) => (
          <span key={i}><b style={{ background: p.color }} />{p.label}: {p.value}</span>
        ))}
      </div>
    </div>
  );
}

// Radar/spider chart: data = [{label, value 0..100}]. Dependency-free SVG.
export function RadarChart({ data, size = 260, color = "var(--primary)" }) {
  const { t } = useApp();
  if (!data || data.length < 3) return <div className="small muted">{t("noData")}</div>;
  const n = data.length;
  const cx = size / 2, cy = size / 2, R = size / 2 - 58;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const rings = [0.25, 0.5, 0.75, 1];
  const poly = data.map((d, i) => pt(i, R * (Math.max(0, Math.min(100, d.value)) / 100)).map((x) => x.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ maxWidth: size }}>
      {rings.map((rr, k) => (
        <polygon key={k} points={data.map((_, i) => pt(i, R * rr).map((x) => x.toFixed(1)).join(",")).join(" ")}
          fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />; })}
      <polygon points={poly} fill={color} fillOpacity="0.28" stroke={color} strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 18);
        const anchor = Math.abs(x - cx) < 10 ? "middle" : (x < cx ? "end" : "start");
        const lbl = (d.label || "");
        const short = lbl.length > 14 ? lbl.slice(0, 13) + "…" : lbl;
        return <text key={i} x={x} y={y} fontSize="8.5" fill="var(--muted)" textAnchor={anchor} dominantBaseline="middle">{short} ({d.value}%)</text>;
      })}
    </svg>
  );
}
