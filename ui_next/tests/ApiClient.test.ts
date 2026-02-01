import { getOrders, previewChanges } from '@/lib/api';

describe('api client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (global as typeof global & { fetch: jest.Mock }).fetch = jest.fn();
  });

  afterEach(() => {
    (global as typeof global & { fetch: typeof originalFetch }).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not force Content-Type header on GET requests', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ asof: null, orders: [] }),
    } as Response);

    await getOrders();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('content-type')).toBeNull();
  });

  it('extracts FastAPI detail errors from JSON responses', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: 'invalid patch payload' }),
      text: async () => '',
    } as Response);

    await expect(previewChanges({ orders: [], positions: [] })).rejects.toThrow(
      'invalid patch payload'
    );
  });
});
