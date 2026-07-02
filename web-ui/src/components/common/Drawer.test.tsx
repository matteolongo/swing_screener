import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react';
import Drawer from './Drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(<Drawer open={false} onClose={() => {}}>content</Drawer>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(<Drawer open onClose={() => {}} title={<span>TD</span>}>content</Drawer>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('TD')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose}>content</Drawer>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the dialog on open', () => {
    render(<Drawer open onClose={() => {}}>content</Drawer>);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('locks body scroll while open and restores on close', () => {
    const originalOverflow = document.body.style.overflow;
    const { rerender } = render(<Drawer open onClose={() => {}}>content</Drawer>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Drawer open={false} onClose={() => {}}>content</Drawer>);
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('ignores Escape when another dialog is stacked on top', () => {
    const onClose = vi.fn();
    render(
      <>
        <Drawer open onClose={onClose}>content</Drawer>
        <div role="dialog" aria-modal="true">nested modal</div>
      </>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
