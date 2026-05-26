export type ReaderFontSize = "sm" | "md" | "lg" | "xl";
export type ReaderLineHeight = "compact" | "normal" | "relaxed";
export type ReaderContentWidth = "narrow" | "standard" | "wide";

export type ReaderPreferences = {
  fontSize: ReaderFontSize;
  lineHeight: ReaderLineHeight;
  width: ReaderContentWidth;
};

export const DEFAULT_READER_PREFS: ReaderPreferences = {
  fontSize: "md",
  lineHeight: "normal",
  width: "standard",
};

const STORAGE_KEY = "ops-reader-prefs";

const FONT_SIZES: ReaderFontSize[] = ["sm", "md", "lg", "xl"];
const LINE_HEIGHTS: ReaderLineHeight[] = ["compact", "normal", "relaxed"];
const WIDTHS: ReaderContentWidth[] = ["narrow", "standard", "wide"];

function isFontSize(v: string): v is ReaderFontSize {
  return (FONT_SIZES as string[]).includes(v);
}
function isLineHeight(v: string): v is ReaderLineHeight {
  return (LINE_HEIGHTS as string[]).includes(v);
}
function isWidth(v: string): v is ReaderContentWidth {
  return (WIDTHS as string[]).includes(v);
}

export function loadReaderPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULT_READER_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READER_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
    return {
      fontSize: parsed.fontSize && isFontSize(parsed.fontSize) ? parsed.fontSize : DEFAULT_READER_PREFS.fontSize,
      lineHeight:
        parsed.lineHeight && isLineHeight(parsed.lineHeight)
          ? parsed.lineHeight
          : DEFAULT_READER_PREFS.lineHeight,
      width: parsed.width && isWidth(parsed.width) ? parsed.width : DEFAULT_READER_PREFS.width,
    };
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

export function saveReaderPreferences(prefs: ReaderPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export const READER_FONT_LABELS: Record<ReaderFontSize, string> = {
  sm: "小",
  md: "中",
  lg: "大",
  xl: "特大",
};

export const READER_LINE_LABELS: Record<ReaderLineHeight, string> = {
  compact: "紧凑",
  normal: "标准",
  relaxed: "宽松",
};

export const READER_WIDTH_LABELS: Record<ReaderContentWidth, string> = {
  narrow: "窄",
  standard: "标准",
  wide: "宽",
};
