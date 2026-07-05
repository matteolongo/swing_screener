import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StrategicReviewPanel from './StrategicReviewPanel';
import * as intelligenceHooks from '@/features/intelligence/hooks';
import type { StrategicReview } from '@/features/intelligence/strategicReviewTypes';
import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';

const I18N_PREFIX = 'workspacePage.panels.analysis.intelligence.strategic';

vi.mock('@/features/intelligence/hooks', () => ({
  useStrategicReviewMutation: vi.fn(),
}));

const review: StrategicReview = {
  generatedAt: '2026-07-04T12:00:00Z',
  inputPolicy: 'app_context_only',
  externalSourceCount: 1,
  memo: 'Strategic overlay built from app context only for ASML.',
  situations: [
    {
      title: 'AI capex versus export controls',
      stage: 'active',
      affectedSymbols: ['ASML'],
      whyNow: ['Export policy news can interrupt technical follow-through.'],
      mechanisms: ['Policy risk can reduce multiple tolerance.'],
      predictions: [
        {
          direction: 'mixed',
          horizonDays: 7,
          thesis: 'Demand remains constructive, but policy risk can interrupt follow-through.',
          confidence: 'medium',
          invalidation: 'Invalidate if export pressure fades.',
        },
      ],
      actions: [
        {
          actionType: 'REVIEW_CONTEXT',
          title: 'Review exposed symbol',
          rationale: 'Reinterpret the current analysis before adding risk.',
          symbols: ['ASML'],
        },
      ],
    },
  ],
};

describe('StrategicReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(intelligenceHooks.useStrategicReviewMutation).mockReturnValue({
      mutate: vi.fn(),
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as never);
  });

  it('runs a manual strategic review with refresh sources and defensive risk mode', async () => {
    const mutate = vi.fn();
    vi.mocked(intelligenceHooks.useStrategicReviewMutation).mockReturnValue({
      mutate,
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    const { user } = renderWithProviders(<StrategicReviewPanel ticker="ASML" />);

    await user.click(screen.getByLabelText(t(`${I18N_PREFIX}.refreshSources`)));
    await user.selectOptions(screen.getByLabelText(t(`${I18N_PREFIX}.riskModeLabel`)), 'defensive');
    await user.click(screen.getByRole('button', { name: t(`${I18N_PREFIX}.runAction`) }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ticker: 'ASML',
        refreshSources: true,
        riskMode: 'defensive',
        horizonDays: 10,
        topic: null,
      });
    });
  });

  it('renders strategic situations, predictions, actions, and memo', () => {
    vi.mocked(intelligenceHooks.useStrategicReviewMutation).mockReturnValue({
      mutate: vi.fn(),
      data: review,
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<StrategicReviewPanel ticker="ASML" />);

    expect(screen.getByText('AI capex versus export controls')).toBeInTheDocument();
    expect(screen.getByText('ASML')).toBeInTheDocument();
    expect(screen.getByText('Demand remains constructive, but policy risk can interrupt follow-through.')).toBeInTheDocument();
    expect(screen.getByText('Review exposed symbol')).toBeInTheDocument();
    expect(screen.getByText('Strategic overlay built from app context only for ASML.')).toBeInTheDocument();
  });
});
