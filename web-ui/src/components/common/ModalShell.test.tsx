import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ModalShell from '@/components/common/ModalShell'

describe('ModalShell', () => {
  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    render(
      <ModalShell title="Test Modal" onClose={onClose}>
        <div>Body</div>
      </ModalShell>
    )

    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on content click', () => {
    const onClose = vi.fn()
    render(
      <ModalShell title="Test Modal" onClose={onClose}>
        <button type="button">Inner</button>
      </ModalShell>
    )

    fireEvent.click(screen.getByText('Inner'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on escape key', () => {
    const onClose = vi.fn()
    render(
      <ModalShell title="Test Modal" onClose={onClose}>
        <div>Body</div>
      </ModalShell>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
