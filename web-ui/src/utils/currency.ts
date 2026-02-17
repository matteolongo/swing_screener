/**
 * Detect currency from ticker symbol
 * EUR stocks typically end with suffixes like .PA (Paris), .AS (Amsterdam), .MI (Milan)
 * USD is the default for most other tickers
 */
export function detectCurrency(ticker: string): 'USD' | 'EUR' {
  const upperTicker = ticker.toUpperCase();
  
  // European exchange suffixes
  const eurSuffixes = [
    '.PA', // Euronext Paris
    '.AS', // Euronext Amsterdam
    '.BR', // Euronext Brussels
    '.LS', // Euronext Lisbon
    '.MI', // Borsa Italiana Milan
    '.MC', // Madrid
    '.DE', // Xetra
    '.F',  // Frankfurt
    '.BE', // Berlin
    '.DU', // Dusseldorf
    '.HM', // Hamburg
    '.HA', // Hanover
    '.MU', // Munich
    '.ST', // Stockholm
    '.CO', // Copenhagen
    '.OL', // Oslo
    '.HE', // Helsinki
    '.VI', // Vienna
    '.IR', // Irish
    '.AT', // Athens
  ];
  
  const hasEurSuffix = eurSuffixes.some(suffix => upperTicker.endsWith(suffix));
  
  return hasEurSuffix ? 'EUR' : 'USD';
}
