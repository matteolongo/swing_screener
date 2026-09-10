import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { t } from '@/i18n/t';
import ManagePositionPanel from './ManagePositionPanel';

const position = {
  positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3,
  targetPrice: 498.26, shares: 2, perShareRisk: 36.74, rNow: 0.51, daysOpen: 10,
  pnl: 0, pnlPercent: 0, entryValue: 766.08, currentValue: 803.64, totalRisk: 73.48,
  feesEur: 0, rFxAdjusted: null, timeStopWarning: false, trailMethod: 'sma20', trailParam: null,
} as any;

describe('ManagePositionPanel', () => {
  it('renders manage actions and no create-entry / setup-fails copy', () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    expect(screen.getByText(t('workspacePage.panels.analysis.managePosition.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.updateStop') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.scaleOut') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.exit') })).toBeInTheDocument();
  });

  it('hides Add-to-position when no actionable entry signal', () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    expect(screen.queryByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).not.toBeInTheDocument();
  });

  it('shows Add-to-position only for a canonical ready add-on', () => {
    const candidate = {
      sameSymbol: { mode: 'ADD_ON' },
      recommendation: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
      executionEligibility: { allowed: true, mode: 'ready', reason: null },
      canonicalOrderDraft: { orderType: 'BUY_STOP', entry: 400, stop: 390, target: 420, shares: 1, rr: 2, quoteCurrency: 'USD', approvalToken: 'signed' },
      decisionSummary: { action: 'WATCH' },
    } as any;
    renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).toBeInTheDocument();
  });

  it('shows Add-to-position for a canonical ready scale-back entry', () => {
    const candidate = {
      sameSymbol: { mode: 'SCALE_BACK' },
      recommendation: { workflowStatus: 'ready', nextStep: { code: 'review_order' } },
      executionEligibility: { allowed: true, mode: 'ready', reason: null },
      canonicalOrderDraft: { orderType: 'BUY_STOP', entry: 400, stop: 390, target: 420, shares: 1, rr: 2, quoteCurrency: 'USD', approvalToken: 'signed' },
      decisionSummary: { action: 'WATCH' },
    } as any;
    renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).toBeInTheDocument();
  });

  it('shows Add-to-position for an approved waiting pullback', () => {
    const candidate = {
      sameSymbol: { mode: 'ADD_ON' },
      suggestedOrderType: 'BUY_LIMIT',
      approvalToken: 'approved-pullback-token',
      recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_pullback' } },
      executionEligibility: { allowed: true, mode: 'pending_pullback', reason: null },
      canonicalOrderDraft: { orderType: 'BUY_LIMIT', entry: 390, stop: 380, target: 410, shares: 1, rr: 2, quoteCurrency: 'USD', approvalToken: 'approved-pullback-token' },
    } as any;
    renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).toBeInTheDocument();
  });

  it('does not promote a BUY_ON_PULLBACK opinion without ready workflow status', () => {
    const candidate = {
      sameSymbol: { mode: 'ADD_ON' },
      recommendation: { workflowStatus: 'waiting_trigger', nextStep: { code: 'wait_pullback' } },
      decisionSummary: { action: 'BUY_ON_PULLBACK' },
    } as any;
    renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
    expect(screen.queryByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).not.toBeInTheDocument();
  });

  it('opens the update-stop modal on click', async () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    await userEvent.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.updateStop') }));
    expect(screen.getByText(t('positions.updateStopModal.title', { ticker: 'LRCX' }))).toBeInTheDocument();
  });

  it('places the read-only live preview before position mutation controls', () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);

    const preview = screen.getByRole('button', {
      name: t('workspacePage.panels.analysis.managePosition.checkLive'),
    });
    const mutation = screen.getByRole('button', {
      name: t('workspacePage.panels.analysis.managePosition.updateStop'),
    });
    expect(Boolean(preview.compareDocumentPosition(mutation) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('preserves update-stop values after a failed mutation', async () => {
    server.use(
      http.put(`${API_BASE_URL}/api/portfolio/positions/:id/stop`, () =>
        HttpResponse.json({ detail: 'Stop update failed' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);

    await user.click(screen.getByRole('button', {
      name: t('workspacePage.panels.analysis.managePosition.updateStop'),
    }));
    await screen.findByText(t('positions.updateStopModal.noUpdateSuggested'));
    const stopInput = screen.getByLabelText(t('positions.updateStopModal.newStopPrice'));
    await user.clear(stopInput);
    await user.type(stopInput, '350');
    fireEvent.submit(stopInput.closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Stop update failed');
    expect(stopInput).toHaveValue(350);
  });

  it('updates the displayed R and explains a live NO_ACTION stop preview', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/portfolio/positions/:id/stop-preview`, () =>
        HttpResponse.json({
          ticker: 'LRCX',
          status: 'open',
          last: 470.5,
          entry: 383.04,
          stop_old: 400,
          stop_suggested: 400,
          shares: 2,
          r_now: 2.38,
          action: 'NO_ACTION',
          reason: 'Trail active; suggested stop 400.00 is not above current stop 400.00, so no stop update.',
        }),
      ),
    );

    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    expect(screen.getByText(`${t('workspacePage.panels.analysis.managePosition.currentR')}: +0.51R`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.checkLive') }));

    expect(await screen.findByText(`${t('workspacePage.panels.analysis.managePosition.currentR')}: +2.38R`)).toBeInTheDocument();
    expect(screen.getByText(/not above current stop/)).toBeInTheDocument();
    expect(screen.getByText(`${t('workspacePage.panels.analysis.managePosition.liveR')}: +2.38R`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t('workspacePage.panels.analysis.managePosition.currentStop')))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t('workspacePage.panels.analysis.managePosition.suggestedStop')))).toBeInTheDocument();
  });
});
