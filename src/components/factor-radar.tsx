/**
 * 因子雷达图：纯 SVG，无依赖，可在 Server Component 中直接渲染。
 * 等级 → GPA（A+=4.3 … F=0）映射半径；null 落在圆心。
 */

import { gradeToGpa, type Grade } from "@/lib/ratings";

export type RadarAxis = { label: string; grade: Grade | null };

const MAX_GPA = 4.3;
const RING_LEVELS = [0.25, 0.5, 0.75, 1];

const GRADE_COLOR: Record<string, string> = {
  A: "#4ade80", B: "#a3e635", C: "#facc15", D: "#fb923c", F: "#f87171",
};
function gradeColor(g: Grade | null): string {
  if (!g) return "var(--muted)";
  return GRADE_COLOR[g[0]] ?? "var(--muted)";
}

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function FactorRadar({
  axes,
  uid = "r",
  size = 240,
  labelGap = 30,
}: {
  axes: RadarAxis[];
  uid?: string;
  size?: number;
  labelGap?: number;
}) {
  const n = axes.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - labelGap - 14;
  const angle = (i: number) => (360 / n) * i;

  const ringPath = (frac: number) =>
    axes.map((_, i) => polar(cx, cy, R * frac, angle(i)).map((v) => v.toFixed(1)).join(",")).join(" ");

  const valuePts = axes.map((a, i) => {
    const gpa = gradeToGpa(a.grade) ?? 0;
    return polar(cx, cy, R * Math.min(1, gpa / MAX_GPA), angle(i));
  });
  const valuePath = valuePts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label="因子雷达图">
      <defs>
        <radialGradient id={`radar-fill-${uid}`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.34" />
        </radialGradient>
        <filter id={`radar-glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 网格环 + 轴线 */}
      {RING_LEVELS.map((f) => (
        <polygon key={f} points={ringPath(f)} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = polar(cx, cy, R, angle(i));
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
      })}

      {/* 数值多边形 */}
      <polygon points={valuePath} fill={`url(#radar-fill-${uid})`} stroke="#fb923c" strokeWidth="2" strokeLinejoin="round" filter={`url(#radar-glow-${uid})`} />
      {valuePts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="#fdba74" stroke="#f97316" strokeWidth="1.5" />
      ))}

      {/* 轴标签 + 等级 */}
      {axes.map((a, i) => {
        const [x, y] = polar(cx, cy, R + 16, angle(i));
        const deg = angle(i);
        const anchor = deg < 10 || deg > 350 || Math.abs(deg - 180) < 10 ? "middle" : deg < 180 ? "start" : "end";
        return (
          <g key={a.label} textAnchor={anchor}>
            <text x={x} y={y} fontSize="10" fontWeight="700" fill="var(--foreground)">
              {a.label}
            </text>
            <text x={x} y={y + 12} fontSize="11" fontWeight="800" fill={gradeColor(a.grade)} fontFamily="var(--font-mono, monospace)">
              {a.grade ?? "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
