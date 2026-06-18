import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RChip from './RChip'

describe('RChip Component', () => {
  it('renders the R-multiple formatted with sign and unit', () => {
    render(<RChip value={2.3} />)
    expect(screen.getByText('+2.30R')).toBeInTheDocument()
  })

  it('formats negative values with the minus sign', () => {
    render(<RChip value={-0.4} />)
    expect(screen.getByText('-0.40R')).toBeInTheDocument()
  })

  it('applies the success color token for non-negative values', () => {
    const { container } = render(<RChip value={1.2} />)
    expect(container.firstChild).toHaveClass('text-success')
  })

  it('applies the danger color token for negative values', () => {
    const { container } = render(<RChip value={-0.7} />)
    expect(container.firstChild).toHaveClass('text-danger')
  })

  it('renders numerics in the tabular mono style', () => {
    const { container } = render(<RChip value={0.8} />)
    expect(container.firstChild).toHaveClass('tabular-nums')
  })

  it('applies a custom className', () => {
    const { container } = render(<RChip value={0.5} className="text-lg" />)
    expect(container.firstChild).toHaveClass('text-lg')
  })
})
