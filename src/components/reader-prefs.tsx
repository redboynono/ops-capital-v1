"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_READER_PREFS,
  READER_FONT_LABELS,
  READER_LINE_LABELS,
  READER_WIDTH_LABELS,
  loadReaderPreferences,
  saveReaderPreferences,
  type ReaderContentWidth,
  type ReaderFontSize,
  type ReaderLineHeight,
  type ReaderPreferences,
} from "@/lib/reader-preferences";

type ReaderPrefsContextValue = {
  prefs: ReaderPreferences;
  setPrefs: (patch: Partial<ReaderPreferences>) => void;
  resetPrefs: () => void;
  enabled: boolean;
};

const ReaderPrefsContext = createContext<ReaderPrefsContextValue | null>(null);

export function ReaderPrefsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [prefs, setPrefsState] = useState<ReaderPreferences>(DEFAULT_READER_PREFS);

  useEffect(() => {
    setPrefsState(loadReaderPreferences());
  }, []);

  const setPrefs = useCallback((patch: Partial<ReaderPreferences>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      saveReaderPreferences(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState(DEFAULT_READER_PREFS);
    saveReaderPreferences(DEFAULT_READER_PREFS);
  }, []);

  const value = useMemo(
    () => ({ prefs, setPrefs, resetPrefs, enabled }),
    [prefs, setPrefs, resetPrefs, enabled],
  );

  return <ReaderPrefsContext.Provider value={value}>{children}</ReaderPrefsContext.Provider>;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6b5c3f]">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] transition-colors ${
              value === opt
                ? "border-[#b08b57] bg-[#efe8dc] text-[#8a4c0e]"
                : "border-[#d8d0c2] text-[#3a3a3a] hover:border-[#b08b57]"
            }`}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReaderPrefsToolbar() {
  const ctx = useContext(ReaderPrefsContext);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!ctx?.enabled) return null;

  const { prefs, setPrefs, resetPrefs } = ctx;
  const isDefault =
    prefs.fontSize === DEFAULT_READER_PREFS.fontSize &&
    prefs.lineHeight === DEFAULT_READER_PREFS.lineHeight &&
    prefs.width === DEFAULT_READER_PREFS.width;

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
        title="阅读设置"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Aa
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="阅读设置"
          className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-sm border border-[#d8d0c2] bg-[#f5f1ea] p-3 shadow-lg"
        >
          <Segmented<ReaderFontSize>
            label="字号"
            value={prefs.fontSize}
            options={["sm", "md", "lg", "xl"] as const}
            labels={READER_FONT_LABELS}
            onChange={(fontSize) => setPrefs({ fontSize })}
          />
          <div className="mt-3">
            <Segmented<ReaderLineHeight>
              label="行距"
              value={prefs.lineHeight}
              options={["compact", "normal", "relaxed"] as const}
              labels={READER_LINE_LABELS}
              onChange={(lineHeight) => setPrefs({ lineHeight })}
            />
          </div>
          <div className="mt-3">
            <Segmented<ReaderContentWidth>
              label="版心"
              value={prefs.width}
              options={["narrow", "standard", "wide"] as const}
              labels={READER_WIDTH_LABELS}
              onChange={(width) => setPrefs({ width })}
            />
          </div>
          {!isDefault ? (
            <button
              type="button"
              onClick={() => {
                resetPrefs();
                setOpen(false);
              }}
              className="mt-3 w-full rounded-sm border border-[#d8d0c2] py-1 font-mono text-[10px] text-[#6b5c3f] hover:border-[#b08b57]"
            >
              恢复默认
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ReaderModeShell({ children }: { children: ReactNode }) {
  const ctx = useContext(ReaderPrefsContext);
  if (!ctx?.enabled) return <div className="mt-3">{children}</div>;

  const { prefs } = ctx;
  return (
    <div
      className="reader-mode mt-3"
      data-font={prefs.fontSize}
      data-leading={prefs.lineHeight}
      data-width={prefs.width}
    >
      {children}
    </div>
  );
}
