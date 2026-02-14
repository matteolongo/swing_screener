import type { MessagesEn } from '@/i18n/messages.en';

type NestedKeyOf<TObj extends object> = {
  [K in keyof TObj & string]: TObj[K] extends object
    ? `${K}.${NestedKeyOf<TObj[K]>}`
    : K;
}[keyof TObj & string];

export type MessageKey = NestedKeyOf<MessagesEn>;

export type MessageParams = Record<string, string | number>;
