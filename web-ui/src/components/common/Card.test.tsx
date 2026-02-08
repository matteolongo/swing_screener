import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Card, { CardHeader, CardTitle, CardContent } from './Card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders children correctly', () => {
      render(<Card>Card Content</Card>)
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })

    it('applies default variant', () => {
      const { container } = render(<Card>Content</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-white')
    })

    it('applies elevated variant', () => {
      const { container } = render(<Card variant="elevated">Content</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('shadow-md')
    })

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('custom-class')
    })
  })

  describe('CardHeader', () => {
    it('renders children correctly', () => {
      render(<CardHeader>Header Content</CardHeader>)
      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })
  })

  describe('CardTitle', () => {
    it('renders children correctly', () => {
      render(<CardTitle>Title</CardTitle>)
      expect(screen.getByText('Title')).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('renders children correctly', () => {
      render(<CardContent>Content</CardContent>)
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('Composition', () => {
    it('renders full card composition correctly', () => {
      render(
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
          </CardHeader>
          <CardContent>
            Test Content
          </CardContent>
        </Card>
      )
      
      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })
  })
})
