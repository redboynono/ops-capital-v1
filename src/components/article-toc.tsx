"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown-toc";

type Props = {
  items: TocItem[];
  /** When true, use reader-mode cream styling */
  readerMode?: boolean;
};

export function ArticleToc({ items, readerMode }: Props) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;
    const observers: IntersectionObserver[] = [];
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActive(it.id);
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  if (items.length < 2) return null;

  const border = readerMode ? "border-[#d8d0c2]" : "border-border";
  const muted = readerMode ? "text-[#6b5c3f]" : "text-muted";
  const activeCls = readerMode ? "text-[#8a4c0e] font-semibold" : "text-accent-strong font-semibold";

  return (
    <nav
      className={`sticky top-24 hidden max-h-[calc(100vh-8rem)] w-48 shrink-0 overflow-y-auto border-l pl-4 text-[12px] xl:block ${border}`}
      aria-label="目录"
    >
      <p className={`label-caps mb-2 text-[10px] ${muted}`}>目录</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} style={{ paddingLeft: it.level === 3 ? 12 : 0 }}>
            <a
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActive(it.id);
              }}
              className={`block py-0.5 leading-snug hover:underline ${
                active === it.id ? activeCls : muted
              }`}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
