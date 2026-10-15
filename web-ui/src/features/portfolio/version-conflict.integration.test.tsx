import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import ManagePositionPanel from '@/components/domain/workspace/ManagePositionPanel';
import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { usePositions } from './hooks';

function CurrentPosition() {
  const positions = usePositions('open');
  return positions.data?.[0] ? <ManagePositionPanel position={positions.data[0]} /> : null;
}

describe('position conflict recovery', () => {
  it('keeps a Book draft when the conflict refresh fails and allows recovery', async () => {
    let changed = false;
    let unavailable = false;
    server.use(
      http.get(`${API_BASE_URL}/api/portfolio/positions`, () => unavailable
        ? HttpResponse.json({}, { status: 503 })
        : HttpResponse.json({ positions: [{ position_id: 'POS-1', ticker: 'AAPL', status: 'open',
          version: changed ? 2 : 1, shares: changed ? 5 : 10, entry_date: '2026-10-01',
          entry_price: 100, stop_price: 95, pnl: 0, pnl_percent: 0, r_now: 0,
          entry_value: 1000, current_value: 1000, per_share_risk: 5, total_risk: 50,
          fees_eur: 0, days_open: 1, time_stop_warning: false,
        }] })),
      http.get(`${API_BASE_URL}/api/portfolio/orders/local`, () => HttpResponse.json({ orders: [] })),
      http.put(`${API_BASE_URL}/api/portfolio/positions/POS-1/stop`, () => {
        changed = true;
        unavailable = true;
        return HttpResponse.json({}, { status: 409 });
      }),
    );
    renderWithProviders(<PortfolioTable />);
    fireEvent.click(await screen.findByRole('button', { name: t('common.actions.updateStop') }));
    const input = screen.getByLabelText(t('positions.updateStopModal.newStopPrice'));
    fireEvent.change(input, { target: { value: '97' } });
    fireEvent.submit(input.closest('form')!);

    await screen.findByText(t('positions.concurrency.unavailable'));
    expect(screen.getByLabelText(t('positions.updateStopModal.newStopPrice'))).toHaveValue(97);
    const updateButtons = screen.getAllByRole('button', { name: t('common.actions.updateStop') });
    expect(updateButtons[updateButtons.length - 1]).toBeDisabled();
    unavailable = false;
    fireEvent.click(screen.getByRole('button', { name: t('positions.concurrency.refresh') }));
    await screen.findByRole('button', { name: t('positions.concurrency.review') });
    expect(screen.getByLabelText(t('positions.updateStopModal.newStopPrice'))).toHaveValue(97);
  });
  it('refetches the changed position and preserves input until deliberate resubmission', async () => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'api');
    let version = 1;
    const submitted: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${API_BASE_URL}/api/portfolio/positions`, () => HttpResponse.json({
        positions: [{ position_id: 'POS-1', ticker: 'AAPL', status: 'open', version,
          entry_date: '2026-10-01', entry_price: 100, stop_price: 95, shares: version === 1 ? 10 : 5,
          initial_risk: 5, pnl: 100, pnl_percent: 10, r_now: 2, entry_value: 1000,
          current_value: 1100, per_share_risk: 5, total_risk: 50, fees_eur: 0,
          days_open: 1, time_stop_warning: false, price_source: 'cached', r_uses_initial_risk: true,
        }],
      })),
      http.post(`${API_BASE_URL}/api/portfolio/positions/POS-1/partial-close`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        submitted.push(body);
        if (submitted.length === 1) {
          version = 2;
          return HttpResponse.json({ detail: t('positions.concurrency.preserved') }, { status: 409 });
        }
        return HttpResponse.json({ status: 'ok' });
      }),
    );
    renderWithProviders(<CurrentPosition />);
    fireEvent.click(await screen.findByRole('button', { name: t('workspacePage.panels.analysis.managePosition.scaleOut') }));
    fireEvent.change(screen.getByLabelText(t('positions.partialCloseModal.sharesLabel')), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(t('positions.partialCloseModal.priceLabel')), { target: { value: '110' } });
    const submitForm = () => fireEvent.submit(screen.getByLabelText(t('positions.partialCloseModal.sharesLabel')).closest('form')!);
    submitForm();

    await screen.findByRole('button', { name: t('positions.concurrency.review') });
    expect(screen.getByLabelText(t('positions.partialCloseModal.sharesLabel'))).toHaveValue(2);
    expect(screen.getByLabelText(t('positions.partialCloseModal.priceLabel'))).toHaveValue(110);
    submitForm();
    expect(submitted).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: t('positions.concurrency.review') }));
    submitForm();

    await waitFor(() => expect(submitted).toHaveLength(2));
    expect(submitted.map(body => body.expected_version)).toEqual([1, 2]);
  });
});
