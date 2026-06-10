import { ImageResponse } from "next/og";

/** Shared OPS Alpha mark for favicon / PWA / Apple touch icon */
export function PwaIconImage({ size }: { size: number }) {
  const fontSize = Math.round(size * 0.52);
  const radius = Math.round(size * 0.08);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0d",
        borderRadius: radius,
      }}
    >
      <div
        style={{
          width: Math.round(size * 0.78),
          height: Math.round(size * 0.78),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e15a3c",
          color: "#0a0a0d",
          fontSize,
          fontWeight: 900,
          borderRadius: Math.max(2, radius - 2),
        }}
      >
        α
      </div>
    </div>
  );
}

export function pwaIconImageResponse(size: number) {
  return new ImageResponse(<PwaIconImage size={size} />, { width: size, height: size });
}
