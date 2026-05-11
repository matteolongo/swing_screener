import { describe, expect, it } from 'vitest';

import { currencyFilterToRequest } from './ScreenerInboxPanel';

describe('currencyFilterToRequest', () => {
  it('does not force currencies when the filter is all', () => {
    expect(currencyFilterToRequest('all')).toBeUndefined();
  });

  it('maps explicit filters to request currencies', () => {
    expect(currencyFilterToRequest('usd')).toEqual(['USD']);
    expect(currencyFilterToRequest('eur')).toEqual(['EUR']);
  });
});
