import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import ManualOrderDraftForm from './ManualOrderDraftForm';

const candidate = { ticker: 'STMPA.PA', currency: 'EUR', entry: 50.43, stop: 49.11, target: 58.18, shares: 8 };

describe('manual order drafts', () => {
  it('saves the full plan as an unapproved draft and links to Book', async () => {
    let payload: Record<string, unknown> | undefined;
    server.use(http.post('*/api/portfolio/orders', async ({ request }) => {
      payload = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...payload, order_id: 'DRAFT-1', status: 'draft', order_date: '2026-10-08', filled_date: null, entry_price: null });
    }));
    const { user } = renderWithProviders(<ManualOrderDraftForm ticker="STMPA.PA" candidate={candidate} />);
    await user.type(screen.getByLabelText(t('order.candidateModal.notes')), 'My manual plan');
    await user.click(screen.getByRole('button', { name: t('manualOrderDraft.save') }));
    expect(await screen.findByRole('status')).toHaveTextContent(t('manualOrderDraft.saved'));
    expect(payload).toMatchObject({ ticker: 'STMPA.PA', save_as_draft: true, currency: 'EUR', quantity: 8, limit_price: 50.43, stop_price: 49.11, target_price: 58.18, notes: 'My manual plan', approval_token: null });
    expect(screen.getByRole('link', { name: t('manualOrderDraft.manage') })).toHaveAttribute('href', '/book');
  });

  it('preserves edited values when saving fails', async () => {
    server.use(http.post('*/api/portfolio/orders', () => HttpResponse.json({ detail: 'Draft save unavailable' }, { status: 503 })));
    const { user } = renderWithProviders(<ManualOrderDraftForm ticker="STMPA.PA" candidate={candidate} />);
    const entry = screen.getByLabelText(t('manualOrderDraft.entry'));
    await user.clear(entry);
    await user.type(entry, '50.6');
    await user.click(screen.getByRole('button', { name: t('manualOrderDraft.save') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Draft save unavailable');
    expect(entry).toHaveValue(50.6);
    expect(screen.getByRole('button', { name: t('manualOrderDraft.save') })).toBeEnabled();
  });

  it('requires a target above entry before calling the API', async () => {
    const save = vi.fn();
    server.use(http.post('*/api/portfolio/orders', () => { save(); return HttpResponse.json({}); }));
    const { user } = renderWithProviders(<ManualOrderDraftForm ticker="STMPA.PA" candidate={candidate} />);
    const target = screen.getByLabelText(t('manualOrderDraft.target'));
    await user.clear(target);
    await user.type(target, '40');
    await user.click(screen.getByRole('button', { name: t('manualOrderDraft.save') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('order.candidateModal.targetError'));
    expect(save).not.toHaveBeenCalled();
  });
});
