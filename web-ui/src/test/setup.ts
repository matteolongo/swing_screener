import '@testing-library/jest-dom/vitest'
import { expect, afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup, act } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { notifyManager } from '@tanstack/react-query'
import type { SetupServerApi } from 'msw/node'

let server: SetupServerApi | null = null
const originalConsoleError = console.error

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Mock localStorage for Zustand persist in tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Start MSW server before all tests
beforeAll(async () => {
  const mod = await import('./mocks/server')
  server = mod.server
  server.listen({ onUnhandledRequest: 'warn' })
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
      return
    }
    originalConsoleError(...args)
  }
  notifyManager.setNotifyFunction((fn) => {
    act(fn)
  })
  notifyManager.setBatchNotifyFunction((fn) => {
    act(fn)
  })
})

// Reset handlers after each test (important for test isolation)
afterEach(() => {
  server?.resetHandlers()
  cleanup()
})

// Stop MSW server after all tests
afterAll(() => {
  console.error = originalConsoleError
  server?.close()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any
