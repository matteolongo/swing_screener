import { i18nRuntime } from '@/i18n/runtime';
import type { Locale } from '@/i18n/resources';
import type { MessageKey, MessageParams } from '@/i18n/types';

export function t(key: MessageKey, params?: MessageParams): string {
  return i18nRuntime.t(key, params);
}

export function getLocale(): Locale {
  return i18nRuntime.getLocale();
}

export function setLocale(locale: Locale): void {
  i18nRuntime.setLocale(locale);
}
