import { RefreshCw, Globe2, Search, ListChecks } from 'lucide-react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import CollapsibleSection from '@/components/common/CollapsibleSection';
import Select from '@/components/common/Select';
import type { SymbolDiscoveryRequest } from '@/features/universes/types';
import type { useSymbolDiscoveryMutation } from '@/features/universes/hooks';
import type { useRunScreenerMutation } from '@/features/screener/hooks';
import { formatCompactNumber } from '@/utils/formatters';
import {
  CURRENCY_PRESETS,
  DISCOVERY_SCREENS,
  MARKET_CAP_PRESETS,
  MARKET_PRESETS,
  TYPE_PRESETS,
  VOLUME_PRESETS,
  taxonomyRows,
} from './universesShared';

interface UniverseDiscoveryTabProps {
  discoveryProvider: SymbolDiscoveryRequest['provider'];
  onProviderChange: (value: SymbolDiscoveryRequest['provider']) => void;
  marketPreset: (typeof MARKET_PRESETS)[number]['value'];
  onMarketPresetChange: (value: (typeof MARKET_PRESETS)[number]['value']) => void;
  currencyPreset: (typeof CURRENCY_PRESETS)[number]['value'];
  onCurrencyPresetChange: (value: (typeof CURRENCY_PRESETS)[number]['value']) => void;
  typePreset: (typeof TYPE_PRESETS)[number]['value'];
  onTypePresetChange: (value: (typeof TYPE_PRESETS)[number]['value']) => void;
  discoveryMinVolume: number;
  onMinVolumeChange: (value: number) => void;
  discoveryMinMarketCap: number;
  onMinMarketCapChange: (value: number) => void;
  discoveryLimit: number;
  onLimitChange: (value: number) => void;
  screenerTop: number;
  onScreenerTopChange: (value: number) => void;
  selectedScreens: string[];
  onToggleScreen: (screen: string) => void;
  selectedMarket: (typeof MARKET_PRESETS)[number];
  yahooUsesCustomScreener: boolean;
  eodhdNeedsKey: boolean;
  discoveryMutation: ReturnType<typeof useSymbolDiscoveryMutation>;
  discoveryScreenerMutation: ReturnType<typeof useRunScreenerMutation>;
  onDiscover: () => void;
  onRunScreener: () => void;
}

export default function UniverseDiscoveryTab({
  discoveryProvider,
  onProviderChange,
  marketPreset,
  onMarketPresetChange,
  currencyPreset,
  onCurrencyPresetChange,
  typePreset,
  onTypePresetChange,
  discoveryMinVolume,
  onMinVolumeChange,
  discoveryMinMarketCap,
  onMinMarketCapChange,
  discoveryLimit,
  onLimitChange,
  screenerTop,
  onScreenerTopChange,
  selectedScreens,
  onToggleScreen,
  selectedMarket,
  yahooUsesCustomScreener,
  eodhdNeedsKey,
  discoveryMutation,
  discoveryScreenerMutation,
  onDiscover,
  onRunScreener,
}: UniverseDiscoveryTabProps) {
  const discoveryResult = discoveryMutation.data;

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Live Discovery</h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Pull fresh candidate symbols from free sources, then review their market, currency, and exchange taxonomy before screening.
            </p>
          </div>
          <Button onClick={onDiscover} disabled={discoveryMutation.isPending || discoveryLimit <= 0} size="sm">
            {discoveryMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Discovering…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Discover Symbols
              </>
            )}
          </Button>
        </div>

        <CollapsibleSection title="Discovery filters">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Provider</span>
            <Select
              value={discoveryProvider}
              onChange={(event) => onProviderChange(event.target.value as SymbolDiscoveryRequest['provider'])}
            >
              <option value="yahoo_predefined">Yahoo predefined</option>
              <option value="eodhd_exchange">EODHD exchange list</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Market</span>
            <Select
              value={marketPreset}
              onChange={(event) => onMarketPresetChange(event.target.value as (typeof MARKET_PRESETS)[number]['value'])}
            >
              {MARKET_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Currency</span>
            <Select
              value={currencyPreset}
              onChange={(event) => onCurrencyPresetChange(event.target.value as (typeof CURRENCY_PRESETS)[number]['value'])}
            >
              {CURRENCY_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Instrument type</span>
            <Select
              value={typePreset}
              onChange={(event) => onTypePresetChange(event.target.value as (typeof TYPE_PRESETS)[number]['value'])}
            >
              {TYPE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Min volume</span>
            <Select
              value={discoveryMinVolume}
              onChange={(event) => onMinVolumeChange(Number(event.target.value))}
            >
              {VOLUME_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Min market cap</span>
            <Select
              value={discoveryMinMarketCap}
              onChange={(event) => onMinMarketCapChange(Number(event.target.value))}
            >
              {MARKET_CAP_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Discovery limit</span>
            <Select
              value={discoveryLimit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              {[25, 50, 100, 200].map((value) => (
                <option key={value} value={value}>{value} symbols</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Screener results</span>
            <Select
              value={screenerTop}
              onChange={(event) => onScreenerTopChange(Number(event.target.value))}
            >
              {[10, 20, 50, 100].map((value) => (
                <option key={value} value={value}>Top {value}</option>
              ))}
            </Select>
          </label>
          <div className="md:col-span-2 xl:col-span-4">
            <div className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Yahoo status screens</div>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_SCREENS.map((screen) => {
                const active = selectedScreens.includes(screen.value);
                return (
                  <button
                    key={screen.value}
                    type="button"
                    onClick={() => onToggleScreen(screen.value)}
                    disabled={discoveryProvider !== 'yahoo_predefined'}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-surface text-muted hover:bg-foreground/5'
                    }`}
                  >
                    {screen.label}
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </CollapsibleSection>

        {yahooUsesCustomScreener ? (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
            Yahoo will use its custom screener endpoint for this market because predefined screeners are mostly US-centric.
          </div>
        ) : null}

        {eodhdNeedsKey ? (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
            EODHD exchange discovery needs `EODHD_API_KEY` configured in the backend environment. Without it, the request will return a setup error instead of live EUR symbols.
          </div>
        ) : null}

        {discoveryMutation.isError ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {discoveryMutation.error instanceof Error ? discoveryMutation.error.message : 'Symbol discovery failed.'}
          </div>
        ) : null}

        {discoveryResult ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Badge variant="default">{discoveryResult.symbols.length} candidates</Badge>
                <Badge variant="default">{discoveryResult.provider}</Badge>
                <Badge variant="default">{selectedMarket.label}</Badge>
                <span>as of {discoveryResult.source_asof}</span>
              </div>
              <Button
                onClick={onRunScreener}
                disabled={discoveryScreenerMutation.isPending || discoveryResult.symbols.length === 0}
                size="sm"
                variant="secondary"
              >
                {discoveryScreenerMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Screening…
                  </>
                ) : (
                  <>
                    <ListChecks className="mr-2 h-4 w-4" />
                    Run Screener on These Symbols
                  </>
                )}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(['currency', 'exchange_mic', 'market', 'instrument_type'] as const).map((key) => (
                <div key={key} className="rounded-xl border border-border bg-surface p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{key.replace('_', ' ')}</div>
                  <div className="flex flex-wrap gap-2">
                    {taxonomyRows(discoveryResult.taxonomy, key).map(([value, count]) => (
                      <Badge key={`${key}-${value}`} variant="default">
                        {value} {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {discoveryResult.notes.length ? (
              <div className="space-y-1 text-sm text-muted">
                {discoveryResult.notes.map((note) => (
                  <div key={note}>{note}</div>
                ))}
              </div>
            ) : null}
            {discoveryResult.symbols.length === 0 ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                No symbols matched this discovery source and filter set. Try a broader market, lower liquidity filters, or screen one of the configured universes below.
              </div>
            ) : null}
            <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Exchange</th>
                    <th className="px-3 py-2">Currency</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Volume</th>
                    <th className="px-3 py-2">Market Cap</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {discoveryResult.symbols.map((symbol) => (
                    <tr key={`${symbol.symbol}-${symbol.source_screen ?? symbol.provider_exchange ?? 'source'}`}>
                      <td className="px-3 py-2 font-medium text-foreground">{symbol.symbol}</td>
                      <td className="px-3 py-2 text-muted">{symbol.name ?? '—'}</td>
                      <td className="px-3 py-2 text-muted">{symbol.exchange_mic ?? symbol.provider_exchange ?? '—'}</td>
                      <td className="px-3 py-2 text-muted">{symbol.currency ?? '—'}</td>
                      <td className="px-3 py-2 text-muted">{symbol.instrument_type ?? '—'}</td>
                      <td className="px-3 py-2 text-muted">{formatCompactNumber(symbol.volume)}</td>
                      <td className="px-3 py-2 text-muted">{formatCompactNumber(symbol.market_cap)}</td>
                      <td className="px-3 py-2 text-muted">{symbol.source_screen ?? symbol.source ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
