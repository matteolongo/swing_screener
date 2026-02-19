import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import Login from './Login'

const { mockAuthMode } = vi.hoisted(() => ({ mockAuthMode: { value: 'csv' as 'csv' | 'managed' } }))

vi.mock('@/lib/authMode', () => ({
  get AUTH_MODE() { return mockAuthMode.value },
  MANAGED_PROVIDER_LABEL: 'Test Provider',
}))

vi.mock('@/features/auth/api', () => ({
  login: vi.fn(),
  exchangeProviderToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  saveSession: vi.fn(),
  getAccessToken: vi.fn(() => null),
  hasAccessToken: vi.fn(() => false),
  getStoredUser: vi.fn(() => null),
  clearSession: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import * as authApi from '@/features/auth/api'
import * as authLib from '@/lib/auth'

describe('Login Page', () => {
  beforeEach(() => {
    mockAuthMode.value = 'csv'
    mockNavigate.mockReset()
    vi.mocked(authApi.login).mockReset()
    vi.mocked(authApi.exchangeProviderToken).mockReset()
    vi.mocked(authLib.saveSession).mockReset()
  })

  describe('CSV mode rendering', () => {
    it('renders email and password fields', () => {
      renderWithProviders(<Login />)
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('does not render provider token textarea', () => {
      renderWithProviders(<Login />)
      expect(screen.queryByLabelText(/provider token/i)).not.toBeInTheDocument()
    })

    it('renders Sign in button', () => {
      renderWithProviders(<Login />)
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('shows sign in description text', () => {
      renderWithProviders(<Login />)
      expect(screen.getByText(/sign in to access your workspace/i)).toBeInTheDocument()
    })
  })

  describe('Managed mode rendering', () => {
    beforeEach(() => {
      mockAuthMode.value = 'managed'
    })

    it('renders provider token textarea', () => {
      renderWithProviders(<Login />)
      expect(screen.getByLabelText(/provider token/i)).toBeInTheDocument()
    })

    it('does not render email and password fields', () => {
      renderWithProviders(<Login />)
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    })

    it('renders Exchange token button', () => {
      renderWithProviders(<Login />)
      expect(screen.getByRole('button', { name: /exchange token/i })).toBeInTheDocument()
    })

    it('shows managed mode description with provider label', () => {
      renderWithProviders(<Login />)
      expect(screen.getByText(/authenticate with test provider/i)).toBeInTheDocument()
    })
  })

  describe('CSV mode submit behavior', () => {
    it('calls login with email and password on submit', async () => {
      const mockResult = {
        accessToken: 'tok',
        tokenType: 'bearer',
        expiresInSeconds: 3600,
        user: { email: 'a@b.com', tenantId: 't1', role: 'member', active: true },
      }
      vi.mocked(authApi.login).mockResolvedValueOnce(mockResult)

      const { user } = renderWithProviders(<Login />)

      await user.type(screen.getByLabelText(/email/i), 'a@b.com')
      await user.type(screen.getByLabelText(/password/i), 'secret')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith('a@b.com', 'secret')
        expect(authLib.saveSession).toHaveBeenCalledWith('tok', mockResult.user)
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })

    it('shows error message on login failure', async () => {
      vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials'))

      const { user } = renderWithProviders(<Login />)

      await user.type(screen.getByLabelText(/email/i), 'a@b.com')
      await user.type(screen.getByLabelText(/password/i), 'wrong')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Managed mode submit behavior', () => {
    beforeEach(() => {
      mockAuthMode.value = 'managed'
    })

    it('calls exchangeProviderToken with trimmed token on submit', async () => {
      const mockResult = {
        accessToken: 'app-tok',
        tokenType: 'bearer',
        expiresInSeconds: 3600,
        user: { email: 'a@b.com', tenantId: 't1', role: 'member', active: true },
      }
      vi.mocked(authApi.exchangeProviderToken).mockResolvedValueOnce(mockResult)

      const { user } = renderWithProviders(<Login />)

      await user.type(screen.getByLabelText(/provider token/i), '  provider-jwt-token  ')
      await user.click(screen.getByRole('button', { name: /exchange token/i }))

      await waitFor(() => {
        expect(authApi.exchangeProviderToken).toHaveBeenCalledWith('provider-jwt-token')
        expect(authLib.saveSession).toHaveBeenCalledWith('app-tok', mockResult.user)
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      })
    })

    it('shows error message on exchange failure', async () => {
      vi.mocked(authApi.exchangeProviderToken).mockRejectedValueOnce(
        new Error('Provider token exchange failed')
      )

      const { user } = renderWithProviders(<Login />)

      await user.type(screen.getByLabelText(/provider token/i), 'bad-token')
      await user.click(screen.getByRole('button', { name: /exchange token/i }))

      await waitFor(() => {
        expect(screen.getByText('Provider token exchange failed')).toBeInTheDocument()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Button text during submission', () => {
    it('shows Signing in... while CSV login is in progress', async () => {
      let resolveLogin!: (v: unknown) => void
      vi.mocked(authApi.login).mockReturnValue(new Promise((r) => { resolveLogin = r }))

      const { user } = renderWithProviders(<Login />)

      await user.type(screen.getByLabelText(/email/i), 'a@b.com')
      await user.type(screen.getByLabelText(/password/i), 'secret')

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /sign in/i }))
      })

      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()

      resolveLogin({
        accessToken: 'tok',
        tokenType: 'bearer',
        expiresInSeconds: 3600,
        user: { email: 'a@b.com', tenantId: 't1', role: 'member', active: true },
      })
    })

    it('shows Signing in... while managed exchange is in progress', async () => {
      mockAuthMode.value = 'managed'
      let resolveExchange!: (v: unknown) => void
      vi.mocked(authApi.exchangeProviderToken).mockReturnValue(
        new Promise((r) => { resolveExchange = r })
      )

      const { user } = renderWithProviders(<Login />)

      await user.type(screen.getByLabelText(/provider token/i), 'some-token')

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /exchange token/i }))
      })

      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()

      resolveExchange({
        accessToken: 'tok',
        tokenType: 'bearer',
        expiresInSeconds: 3600,
        user: { email: 'a@b.com', tenantId: 't1', role: 'member', active: true },
      })
    })
  })
})
