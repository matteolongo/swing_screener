import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatPercent, formatNumber, formatRatioAsPercent } from './formatters'

describe('Formatter Utilities', () => {
  describe('formatCurrency', () => {
    it('formats positive numbers correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00')
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(1000000)).toBe('$1,000,000.00')
    })

    it('formats negative numbers correctly', () => {
      expect(formatCurrency(-100)).toBe('-$100.00')
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
    })

    it('formats zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('rounds to 2 decimal places', () => {
      expect(formatCurrency(123.456)).toBe('$123.46')
      expect(formatCurrency(123.454)).toBe('$123.45')
    })

    it('handles very small numbers', () => {
      expect(formatCurrency(0.01)).toBe('$0.01')
      expect(formatCurrency(0.005)).toBe('$0.01')
      expect(formatCurrency(0.004)).toBe('$0.00')
    })

    it('handles very large numbers', () => {
      expect(formatCurrency(999999999.99)).toBe('$999,999,999.99')
    })
  })

  describe('formatDate', () => {
    it('formats ISO date string correctly', () => {
      expect(formatDate('2026-02-08')).toBe('Feb 8, 2026')
      expect(formatDate('2026-01-15')).toBe('Jan 15, 2026')
      expect(formatDate('2026-12-31')).toBe('Dec 31, 2026')
    })

    it('handles different date formats', () => {
      // ISO with time
      expect(formatDate('2026-02-08T00:00:00')).toMatch(/Feb 8, 2026/)
    })

    it('handles date objects', () => {
      const date = new Date('2026-02-08')
      const result = formatDate(date)
      expect(result).toMatch(/Feb/)
    })
  })

  describe('formatPercent', () => {
    // formatPercent expects raw percentage values, not decimals
    it('formats positive percentages correctly', () => {
      expect(formatPercent(25)).toBe('+25.0%')
      expect(formatPercent(10)).toBe('+10.0%')
      expect(formatPercent(150)).toBe('+150.0%')
    })

    it('formats negative percentages correctly', () => {
      expect(formatPercent(-25)).toBe('-25.0%')
      expect(formatPercent(-10)).toBe('-10.0%')
    })

    it('formats zero correctly', () => {
      expect(formatPercent(0)).toBe('+0.0%')
    })

    it('rounds to 1 decimal place by default', () => {
      expect(formatPercent(12.345)).toBe('+12.3%')
      expect(formatPercent(12.351)).toBe('+12.4%')
    })

    it('supports custom decimal places', () => {
      expect(formatPercent(12.345, 2)).toBe('+12.35%')
      expect(formatPercent(12.345, 0)).toBe('+12%')
    })

    it('handles very large percentages', () => {
      expect(formatPercent(1050.5)).toBe('+1050.5%')
    })
  })

  describe('formatRatioAsPercent', () => {
    it('converts ratios to percents before formatting', () => {
      expect(formatRatioAsPercent(0.0082)).toBe('+0.8%')
      expect(formatRatioAsPercent(0.02)).toBe('+2.0%')
      expect(formatRatioAsPercent(-0.015)).toBe('-1.5%')
    })

    it('supports custom decimal places', () => {
      expect(formatRatioAsPercent(0.00821, 2)).toBe('+0.82%')
    })
  })

  describe('formatNumber', () => {
    it('formats positive numbers with default 2 decimals', () => {
      expect(formatNumber(123.456)).toBe('123.46')
      expect(formatNumber(100)).toBe('100.00')
      expect(formatNumber(1.2)).toBe('1.20')
    })

    it('formats negative numbers correctly', () => {
      expect(formatNumber(-123.456)).toBe('-123.46')
      expect(formatNumber(-1.5)).toBe('-1.50')
    })

    it('formats zero correctly', () => {
      expect(formatNumber(0)).toBe('0.00')
      expect(formatNumber(0, 1)).toBe('0.0')
    })

    it('supports custom decimal places', () => {
      expect(formatNumber(123.456, 0)).toBe('123')
      expect(formatNumber(123.456, 1)).toBe('123.5')
      expect(formatNumber(123.456, 3)).toBe('123.456')
    })

    it('rounds correctly', () => {
      expect(formatNumber(2.345, 2)).toBe('2.35')
      expect(formatNumber(2.344, 2)).toBe('2.34')
      expect(formatNumber(1.5, 0)).toBe('2')
    })

    it('handles very small numbers', () => {
      expect(formatNumber(0.001, 3)).toBe('0.001')
      expect(formatNumber(0.0001, 2)).toBe('0.00')
    })

    it('handles very large numbers', () => {
      expect(formatNumber(999999.99, 2)).toBe('999999.99')
    })
  })
})
