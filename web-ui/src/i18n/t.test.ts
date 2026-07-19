import { describe, expect, it } from 'vitest'
import { getLocale, setLocale, t } from '@/i18n/t'

describe('t', () => {
  it('resolves simple messages', () => {
    expect(t('common.actions.close')).toBe('Close')
  })

  it('interpolates placeholders', () => {
    expect(t('order.candidateModal.title', { ticker: 'VALE' })).toBe('Create Order - VALE')
  })

  it('interpolates the order decision gate statuses', () => {
    expect(t('order.review.decisionGateStatus', {
      setup: 'PASS',
      trigger: 'WAIT',
      plan: 'BLOCK',
      data: 'stale',
    })).toBe('Setup: PASS · Trigger: WAIT · Plan: BLOCK · Data: stale.')
  })

  it('falls back to key when missing', () => {
    expect(t('missing.path' as never)).toBe('missing.path')
  })

  it('keeps runtime locale in sync', () => {
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(t('common.actions.refresh')).toBe('Refresh')
  })
})
