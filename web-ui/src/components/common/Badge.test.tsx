import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge Component', () => {
  it('renders children text', () => {
    render(<Badge>Badge Text</Badge>)
    expect(screen.getByText('Badge Text')).toBeInTheDocument()
  })

  it('renders default variant', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-foreground/5')
  })

  it('renders success variant correctly', () => {
    const { container } = render(<Badge variant="success">Success</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-success/10')
  })

  it('renders warning variant correctly', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-warning/10')
  })

  it('renders error variant correctly', () => {
    const { container } = render(<Badge variant="error">Error</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('bg-danger/10')
  })

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-badge">Custom</Badge>)
    const badge = container.firstChild as HTMLElement
    expect(badge).toHaveClass('custom-badge')
  })
})
