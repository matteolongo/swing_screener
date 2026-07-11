import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('locks document scroll while mounted and restores on unmount', () => {
    const previousOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    const { unmount } = render(
      <ModalShell title="Test Modal" onClose={() => {}}>
        <div>Body</div>
      </ModalShell>
    )

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe(previousOverflow)
    expect(document.documentElement.style.overflow).toBe(previousHtmlOverflow)
  })

  it('renders full-screen when requested', () => {
    render(
      <ModalShell title="Test Modal" onClose={() => {}} fullScreen>
        <div>Body</div>
      </ModalShell>
    )

    expect(screen.getByRole('dialog')).toHaveClass('h-dvh')
    expect(screen.getByRole('dialog')).toHaveClass('rounded-none')
  })

  it('names the dialog from the visible title and traps tab focus', async () => {
    render(
      <ModalShell title="Test Modal" onClose={() => {}}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </ModalShell>
    )

    const dialog = screen.getByRole('dialog', { name: 'Test Modal' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus()
  })
})
