import { z } from 'zod';
import { t } from '@/i18n/t';

export const candidateOrderSchema = z
  .object({
    orderType: z.enum(['BUY_LIMIT', 'BUY_MARKET']),
    quantity: z.number().int().min(1, t('order.candidateModal.quantityError')),
    limitPrice: z.number().positive(t('order.candidateModal.limitError')),
    stopPrice: z.number().positive(t('order.candidateModal.stopPositiveError')),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.limitPrice <= values.stopPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t('order.candidateModal.stopError'),
        path: ['stopPrice'],
      });
    }
  });

export type CandidateOrderFormValues = z.infer<typeof candidateOrderSchema>;

export const createOrderSchema = z
  .object({
    ticker: z.string().min(1),
    orderType: z.enum(['BUY_LIMIT', 'SELL_LIMIT', 'BUY_MARKET', 'SELL_MARKET']),
    orderKind: z.enum(['entry', 'stop', 'take_profit']),
    quantity: z.number().int().min(1),
    limitPrice: z.number().nonnegative(),
    stopPrice: z.number().nonnegative(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (
      (values.orderType === 'BUY_LIMIT' || values.orderType === 'SELL_LIMIT') &&
      values.limitPrice <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t('order.candidateModal.limitError'),
        path: ['limitPrice'],
      });
    }
  });

export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

export const fillOrderSchema = z.object({
  filledPrice: z.number().positive(),
  filledDate: z.string().min(1),
  stopPrice: z.number().positive().optional(),
});

export type FillOrderFormValues = z.infer<typeof fillOrderSchema>;
