import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react';
import { createPortal } from 'react-dom';
import Drawer from './Drawer';

/**
 * Renders a fake stacked modal via a portal to document.body, mirroring how
 * ModalShell (and Drawer itself) mount their dialog content. Rendering the
 * nested dialog as a plain child of the RTL container would place it BEFORE
 * the drawer's portal content in document.body child order (the container
 * div is appended to body first, then the drawer's own portal appends after
 * it), which would misrepresent which dialog is actually topmost.
 */
function NestedModal() {
  return createPortal(
    <div role="dialog" aria-modal="true">nested modal</div>,
    document.body
  );
}

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
    const { rerender } = render(<Drawer open onClose={() => {}}>content</Drawer>);
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    rerender(<Drawer open={false} onClose={() => {}}>content</Drawer>);
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('ignores Escape when another dialog is stacked on top', () => {
    const onClose = vi.fn();
    render(
      <>
        <Drawer open onClose={onClose}>content</Drawer>
        <NestedModal />
      </>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps body scroll locked while any drawer is open, ref-counting nested opens', () => {
    const { rerender } = render(
      <>
        <Drawer open onClose={() => {}}>bottom content</Drawer>
        <Drawer open onClose={() => {}}>top content</Drawer>
      </>
    );
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    rerender(
      <>
        <Drawer open onClose={() => {}}>bottom content</Drawer>
        <Drawer open={false} onClose={() => {}}>top content</Drawer>
      </>
    );
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    rerender(
      <>
        <Drawer open={false} onClose={() => {}}>bottom content</Drawer>
        <Drawer open={false} onClose={() => {}}>top content</Drawer>
      </>
    );
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('closes on Escape when this drawer is the topmost dialog', () => {
    const onCloseBottom = vi.fn();
    const onCloseTop = vi.fn();
    render(
      <>
        <Drawer open onClose={onCloseBottom}>bottom content</Drawer>
        <Drawer open onClose={onCloseTop}>top content</Drawer>
      </>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseTop).toHaveBeenCalled();
    expect(onCloseBottom).not.toHaveBeenCalled();
  });
});
