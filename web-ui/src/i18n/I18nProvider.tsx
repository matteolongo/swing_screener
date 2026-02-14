import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { defaultLocale, type Locale } from '@/i18n/resources';
import { i18nRuntime } from '@/i18n/runtime';
import { t } from '@/i18n/t';

type I18nContextValue = {
  locale: Locale;
  locales: Locale[];
  setLocale: (locale: Locale) => void;
  t: typeof t;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: ReactNode;
  initialLocale?: Locale;
};

export function I18nProvider({ children, initialLocale = defaultLocale }: I18nProviderProps) {
  useEffect(() => {
    i18nRuntime.setLocale(initialLocale);
  }, [initialLocale]);

  const locale = useSyncExternalStore(
    i18nRuntime.subscribe,
    i18nRuntime.getLocale,
    i18nRuntime.getLocale,
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      locales: i18nRuntime.getSupportedLocales(),
      setLocale: i18nRuntime.setLocale,
      t,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
