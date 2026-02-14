import { messagesEn } from '@/i18n/messages.en';

export const resources = {
  en: messagesEn,
} as const;

export type Locale = keyof typeof resources;

export const defaultLocale: Locale = 'en';
