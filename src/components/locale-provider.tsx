"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/zh";
import type { Locale } from "@/lib/i18n/locale-types";

const LocaleContext = createContext<Locale>("zh");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useDict(): Dictionary {
  return getDictionary(useLocale());
}
