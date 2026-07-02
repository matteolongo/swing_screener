import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import Tabs, { type TabItem } from '@/components/common/Tabs';
import ScreenerPanel from '@/components/domain/screener/ScreenerPanel';
import WatchlistPipelinePanel from '@/components/domain/watchlist/WatchlistPipelinePanel';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

type ScreenerTab = 'candidates' | 'watchlist';

const isScreenerTab = (value: string | null): value is ScreenerTab =>
  value === 'candidates' || value === 'watchlist';

export default function Screener() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeTab: ScreenerTab = isScreenerTab(rawTab) ? rawTab : 'candidates';

  const handleTabChange = useCallback((tab: ScreenerTab) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleTickerSelect = useCallback((ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  }, [setSelectedTicker]);

  const tabs: TabItem<ScreenerTab>[] = useMemo(() => [
    { id: 'candidates', label: t('screenerPage.tabs.candidates') },
    { id: 'watchlist', label: t('screenerPage.tabs.watchlist') },
  ], []);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title={t('screenerPage.title')} />
      <Tabs tabs={tabs} active={activeTab} onChange={handleTabChange} className="mb-3" />
      {activeTab === 'candidates' && <ScreenerPanel />}
      {activeTab === 'watchlist' && (
        <WatchlistPipelinePanel onTickerSelect={handleTickerSelect} />
      )}
    </div>
  );
}
