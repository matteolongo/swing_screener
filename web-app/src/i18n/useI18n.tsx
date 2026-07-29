import { createContext, useContext, useCallback } from 'react';
import en from './en.json';

type I18nDict = typeof en;

const I18nContext = createContext<I18nDict>(en);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <I18nContext.Provider value={en}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const dict = useContext(I18nContext);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = dict;
    for (const k of keys) {
      value = value?.[k];
    }
    if (typeof value === 'string' && params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, String(v)),
        value,
      );
    }
    return typeof value === 'string' ? value : key;
  }, [dict]);

  return { t, locale: 'en' };
}
