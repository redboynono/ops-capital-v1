import type { PricePoint } from "@/lib/price-history";

/**
 * 纯 SVG sparkline，无依赖。
 * 用 `?` decoded close-only series，归一化到 [0,1]，按 viewBox 100x30 渲染折线。
 * 自动按起涨/起跌着色（绿/红 = success/danger）。
 */
export function Sparkline({
  points,
  width = 200,
  height = 48,
  className,
  showLast = true,
}: {
  points: PricePoint[];
  width?: number;
  height?: number;
  className?: string;
  showLast?: boolean;
}) {
  if (points.length < 2) {
    return (
      <div
        className={`flex h-12 items-center justify-center text-[10px] text-muted ${className ?? ""}`}
        style={{ width, height }}
      >
        无价格历史
      </div>
    );
  }

  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.c);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const padX = 1;
  const padY = 3;
  const vbW = 100;
  const vbH = 30;
  const x = (i: number) => padX + ((vbW - 2 * padX) * i) / (xs.length - 1);
  const y = (v: number) => padY + (vbH - 2 * padY) * (1 - (v - minY) / rangeY);

  let path = `M ${x(0).toFixed(2)} ${y(ys[0]).toFixed(2)}`;
  for (let i = 1; i < ys.length; i++) {
    path += ` L ${x(i).toFixed(2)} ${y(ys[i]).toFixed(2)}`;
  }

  const first = ys[0];
  const last = ys[ys.length - 1];
  const up = last >= first;
  const stroke = up ? "var(--success)" : "var(--danger)";
  const fill = up ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)";

  const area = `${path} L ${x(ys.length - 1).toFixed(2)} ${(vbH - padY).toFixed(2)} L ${x(0).toFixed(2)} ${(vbH - padY).toFixed(2)} Z`;

  const changePct = first > 0 ? (last / first - 1) * 100 : 0;
  const sign = changePct >= 0 ? "+" : "";
  const lastCx = x(ys.length - 1);
  const lastCy = y(last);

  return (
    <div className={`relative ${className ?? ""}`} style={{ width, height }}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        width={width}
        height={height}
        style={{ display: "block" }}
        aria-hidden
      >
        <path d={area} fill={fill} stroke="none" />
        <path d={path} fill="none" stroke={stroke} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <circle cx={lastCx} cy={lastCy} r={1.4} fill={stroke} />
      </svg>
      {showLast ? (
        <span
          className="absolute right-1 top-0 mono text-[10px] font-semibold"
          style={{ color: stroke }}
        >
          {sign}
          {changePct.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}
