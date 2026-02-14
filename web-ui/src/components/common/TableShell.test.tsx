import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import TableShell from '@/components/common/TableShell'

describe('TableShell', () => {
  it('renders loading state', () => {
    render(
      <TableShell loading headers={<tr><th>Col</th></tr>} emptyMessage="Empty">
        <tr><td>Row</td></tr>
      </TableShell>
    )

    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders empty state', () => {
    render(
      <TableShell empty headers={<tr><th>Col</th></tr>} emptyMessage="Nothing here">
        <tr><td>Row</td></tr>
      </TableShell>
    )

    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders table content', () => {
    render(
      <TableShell headers={<tr><th>Ticker</th></tr>}>
        <tr><td>AAPL</td></tr>
      </TableShell>
    )

    expect(screen.getByText('Ticker')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
  })
})
