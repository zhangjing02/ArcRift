import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { type Locale, LOCALES, getNodeTypeLabel as getLabel, getNodeTypeAbbr as getAbbr } from "../constants/locales";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: typeof LOCALES.zh;
  getNodeTypeLabel: (type: string) => string;
  getNodeTypeAbbr: (type: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const STORAGE_KEY = "ArcRift_dashboard_locale";

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") return saved;
    } catch {
      // ignore
    }
    return "zh"; // Default to Chinese as requested
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  };

  const toggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useMemo(() => LOCALES[locale] || LOCALES.zh, [locale]);

  const getNodeTypeLabel = (type: string) => getLabel(type, locale);
  const getNodeTypeAbbr = (type: string) => getAbbr(type, locale);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      getNodeTypeLabel,
      getNodeTypeAbbr,
    }),
    [locale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
