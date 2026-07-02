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
});
