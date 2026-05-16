import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OrderReadinessGate from './OrderReadinessGate';
import { t } from '@/i18n/t';

const CHILD_TEXT = 'Order form goes here';

function renderGate(readiness: Parameters<typeof OrderReadinessGate>[0]['readiness']) {
  return renderWithProviders(
    <OrderReadinessGate readiness={readiness}>
      <div>{CHILD_TEXT}</div>
    </OrderReadinessGate>,
  );
}

describe('OrderReadinessGate', () => {
  it('renders children directly when readiness is ready', () => {
    renderGate('ready');
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(t('orderGate.notReadyWarning'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('orderGate.avoidWarning'))).not.toBeInTheDocument();
  });

  it('renders children directly when readiness is manage_existing', () => {
    renderGate('manage_existing');
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(t('orderGate.notReadyWarning'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('orderGate.avoidWarning'))).not.toBeInTheDocument();
  });

  it('shows warning banner when readiness is wait_for_price, children still visible', () => {
    renderGate('wait_for_price');
    expect(screen.getByText(t('orderGate.notReadyWarning'))).toBeInTheDocument();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(t('orderGate.avoidWarning'))).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows warning banner when readiness is watch_only, children still visible', () => {
    renderGate('watch_only');
    expect(screen.getByText(t('orderGate.notReadyWarning'))).toBeInTheDocument();
    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(t('orderGate.avoidWarning'))).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows warning and checkbox when readiness is avoid, children hidden initially', () => {
    renderGate('avoid');
    expect(screen.getByText(t('orderGate.avoidWarning'))).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(t('orderGate.overrideLabel'))).toBeInTheDocument();
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();
  });

  it('shows children when override checkbox is checked for avoid readiness', async () => {
    const { user } = renderGate('avoid');
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
  });

  it('shows warning and checkbox when readiness is incomplete, children hidden initially', () => {
    renderGate('incomplete');
    expect(screen.getByText(t('orderGate.avoidWarning'))).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(t('orderGate.overrideLabel'))).toBeInTheDocument();
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();
  });

  it('shows children when override checkbox is checked for incomplete readiness', async () => {
    const { user } = renderGate('incomplete');
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
  });
});
