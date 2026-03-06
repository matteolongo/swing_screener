import { setupServer } from 'msw/node'
import { handlers, resetMockApiState } from './handlers'

// Setup MSW server with request handlers
export const server = setupServer(...handlers)
export { resetMockApiState }
