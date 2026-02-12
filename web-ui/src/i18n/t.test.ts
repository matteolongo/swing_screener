import { describe, expect, it } from 'vitest'
import { t } from '@/i18n/t'

describe('t', () => {
  it('resolves simple messages', () => {
    expect(t('common.actions.close')).toBe('Close')
  })

  it('interpolates placeholders', () => {
    expect(t('order.candidateModal.title', { ticker: 'VALE' })).toBe('Create Order - VALE')
  })

  it('falls back to key when missing', () => {
    expect(t('missing.path' as never)).toBe('missing.path')
  })
})
