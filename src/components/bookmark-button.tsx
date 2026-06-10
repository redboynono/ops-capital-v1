"use client";

import { useState, useTransition } from "react";

export function BookmarkButton({
  postId,
  initialBookmarked,
}: {
  postId: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !bookmarked;
    setBookmarked(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/me/bookmarks", {
          method: next ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
        });
        if (!res.ok) {
          setBookmarked(!next);
        }
      } catch {
        setBookmarked(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={bookmarked}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-60 ${
        bookmarked
          ? "border-accent bg-[color:var(--accent-soft)] text-accent-strong"
          : "border-border-strong text-muted hover:text-accent-strong hover:border-accent"
      }`}
    >
      <span aria-hidden>{bookmarked ? "★" : "☆"}</span>
      {bookmarked ? "已收藏" : "收藏"}
    </button>
  );
}
