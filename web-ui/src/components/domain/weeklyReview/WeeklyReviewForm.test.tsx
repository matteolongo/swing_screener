import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import WeeklyReviewForm, { getCurrentWeekId } from './WeeklyReviewForm';

describe('WeeklyReviewForm', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['2026-01-05T12:00:00Z', '2026-W02'],
    ['2026-10-01T12:00:00Z', '2026-W40'],
    ['2021-01-01T12:00:00Z', '2020-W53'],
  ])('returns the ISO week-year for %s', (now, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    expect(getCurrentWeekId()).toBe(expected);
  });

  it('associates each review prompt with its textarea', async () => {
    renderWithProviders(<WeeklyReviewForm weekId="2026-W18" />);

    const fields = [
      t('weeklyReview.fields.whatWorked.label'),
      t('weeklyReview.fields.whatDidnt.label'),
      t('weeklyReview.fields.rulesViolated.label'),
      t('weeklyReview.fields.nextWeekFocus.label'),
    ];

    for (const label of fields) {
      expect(await screen.findByLabelText(label)).toBeInTheDocument();
    }
  });
});
