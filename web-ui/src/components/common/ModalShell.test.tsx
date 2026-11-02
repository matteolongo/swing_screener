import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ModalShell from '@/components/common/ModalShell'
import { renderWithProviders } from '@/test/utils'
import { t } from '@/i18n/t'

describe('ModalShell', () => {
  it('leaves Tab free to reach the final native summary and wraps back to it', () => {
    renderWithProviders(
      <ModalShell title={t('order.review.formTitle')} onClose={() => {}}>
        <button type="button">{t('common.actions.cancel')}</button>
        <details>
          <summary>{t('order.review.brokerStepsTitle')}</summary>
          <summary>{t('order.review.degiroSetupTitle')}</summary>
        </details>
      </ModalShell>,
    )
    const lastButton = screen.getByRole('button', { name: t('common.actions.cancel') })
    const summary = screen.getByText(t('order.review.brokerStepsTitle'))
    lastButton.focus()
    expect(fireEvent.keyDown(lastButton, { key: 'Tab' })).toBe(true)

    const close = screen.getByRole('button', { name: t('modal.closeAria') })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(summary).toHaveFocus()

    fireEvent.keyDown(summary, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('cycles through opened disclosure controls and restores the opener on Escape', async () => {
    const user = userEvent.setup()
    function DisclosureDialog() {
      const [open, setOpen] = useState(false)
      return <>
        <button type="button" onClick={() => setOpen(true)}>{t('order.review.formTitle')}</button>
        {open && <ModalShell title={t('order.review.formTitle')} onClose={() => setOpen(false)} fullScreen>
          <button type="button">{t('common.actions.cancel')}</button>
          <details open>
            <summary>{t('order.review.brokerStepsTitle')}</summary>
            <button type="button">{t('common.actions.fillOrder')}</button>
            <details>
              <summary>{t('order.review.degiroSetupTitle')}</summary>
              <button type="button">{t('common.actions.save')}</button>
            </details>
            <div hidden><button type="button">{t('common.actions.close')}</button></div>
          </details>
        </ModalShell>}
      </>
    }
    renderWithProviders(<DisclosureDialog />)
    const opener = screen.getByRole('button', { name: t('order.review.formTitle') })
    await user.click(opener)
    screen.getByRole('button', { name: t('common.actions.fillOrder') }).focus()
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(true)
    const close = screen.getByRole('button', { name: t('modal.closeAria') })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(screen.getByText(t('order.review.degiroSetupTitle'))).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

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
