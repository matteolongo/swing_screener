import { defaultLocale, type Locale, resources } from '@/i18n/resources';
import type { MessageKey, MessageParams } from '@/i18n/types';

const TEMPLATE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

type Subscriber = () => void;

function resolveMessage(locale: Locale, key: string): string | undefined {
  const segments = key.split('.');
  let current: unknown = resources[locale];

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;

  return template.replace(TEMPLATE_PATTERN, (fullMatch, key) => {
    const value = params[key];
    return value == null ? fullMatch : String(value);
  });
}

class I18nRuntime {
  private locale: Locale = defaultLocale;
  private subscribers = new Set<Subscriber>();

  getLocale = (): Locale => this.locale;

  getSupportedLocales = (): Locale[] => Object.keys(resources) as Locale[];

  setLocale = (locale: Locale): void => {
    if (this.locale === locale) return;
    this.locale = locale;
    this.subscribers.forEach((listener) => listener());
  };

  subscribe = (listener: Subscriber): (() => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  t = (key: MessageKey, params?: MessageParams): string => {
    const message = resolveMessage(this.locale, key) ?? resolveMessage(defaultLocale, key);
    if (!message) return key;
    return interpolate(message, params);
  };
}

export const i18nRuntime = new I18nRuntime();
