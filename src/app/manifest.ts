import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OPS Alpha",
    short_name: "OPS Alpha",
    description: "AI 驱动的中文投研终端：深度研报、快讯、期权 Copilot 与自选股桌面",
    start_url: "/alpha",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0d",
    theme_color: "#0a0a0d",
    lang: "zh-CN",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
