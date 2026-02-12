import { messagesEn } from '@/i18n/messages.en';
import type { MessageKey, MessageParams } from '@/i18n/types';

const TEMPLATE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function resolveMessage(key: string): string | undefined {
  const segments = key.split('.');
  let current: unknown = messagesEn;

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

export function t(key: MessageKey, params?: MessageParams): string {
  const message = resolveMessage(key);
  if (!message) return key;
  return interpolate(message, params);
}
