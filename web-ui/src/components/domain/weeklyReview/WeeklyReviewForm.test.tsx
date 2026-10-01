import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import WeeklyReviewForm from './WeeklyReviewForm';

describe('WeeklyReviewForm', () => {
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
