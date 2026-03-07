import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnwatchSymbolMutation, useWatchSymbolMutation, useWatchlist } from '@/features/watchlist/hooks';
import type { WatchItem } from '@/features/watchlist/types';
import type { DailyReviewCandidate } from '@/features/dailyReview/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const MOBILE_LAYOUT_MEDIA_QUERY = '(max-width: 767px)';

function getMobileLayoutMatch() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches;
}

export interface DailyReviewPageState {
  expandedSections: { candidates: boolean; hold: boolean; update: boolean; close: boolean };
  toggleSection: (section: 'candidates' | 'hold' | 'update' | 'close') => void;
  insightCandidate: DailyReviewCandidate | null;
  setInsightCandidate: (candidate: DailyReviewCandidate | null) => void;
  showCreateOrderModal: boolean;
  setShowCreateOrderModal: (show: boolean) => void;
  selectedCandidate: DailyReviewCandidate | null;
  setSelectedCandidate: (candidate: DailyReviewCandidate | null) => void;
  dismissedReadinessBlocker: boolean;
  setDismissedReadinessBlocker: (dismissed: boolean) => void;
  isCompactMobileLayout: boolean;
  watchItemsByTicker: Map<string, WatchItem>;
  watchPending: boolean;
  handleWatch: (ticker: string, currentPrice: number | null | undefined, source: string) => void;
  handleUnwatch: (ticker: string) => void;
  openWorkspacePortfolioAction: (params: {
    action: 'update-stop' | 'close-position';
    ticker: string;
    positionId: string;
  }) => void;
}

export function useDailyReviewPageState(): DailyReviewPageState {
  const [expandedSections, setExpandedSections] = useState({
    candidates: true,
    hold: false,
    update: true,
    close: true,
  });
  const [insightCandidate, setInsightCandidate] = useState<DailyReviewCandidate | null>(null);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<DailyReviewCandidate | null>(null);
  const [dismissedReadinessBlocker, setDismissedReadinessBlocker] = useLocalStorage(
    'dailyReview.dismissedReadinessBlocker',
    false,
    // Handle both legacy raw-string ("true") and new JSON (true) formats
    (val) => val === true || val === 'true',
  );
  const [isCompactMobileLayout, setIsCompactMobileLayout] = useState(getMobileLayoutMatch);

  const navigate = useNavigate();
  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();

  const watchItemsByTicker = useMemo(() => {
    const map = new Map<string, WatchItem>();
    for (const item of watchlistQuery.data ?? []) {
      map.set(item.ticker.toUpperCase(), item);
    }
    return map;
  }, [watchlistQuery.data]);

  const handleWatch = useCallback(
    (ticker: string, currentPrice: number | null | undefined, source: string) => {
      const normalizedTicker = ticker.trim().toUpperCase();
      if (!normalizedTicker || watchItemsByTicker.has(normalizedTicker)) {
        return;
      }
      watchSymbolMutation.mutate({
        ticker: normalizedTicker,
        watchPrice: currentPrice ?? null,
        currency: null,
        source,
      });
    },
    [watchItemsByTicker, watchSymbolMutation],
  );

  const handleUnwatch = useCallback(
    (ticker: string) => {
      const normalizedTicker = ticker.trim().toUpperCase();
      if (!normalizedTicker || !watchItemsByTicker.has(normalizedTicker)) {
        return;
      }
      unwatchSymbolMutation.mutate(normalizedTicker);
    },
    [watchItemsByTicker, unwatchSymbolMutation],
  );

  const watchPending = watchSymbolMutation.isPending || unwatchSymbolMutation.isPending;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQueryList = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactMobileLayout(event.matches);
    };
    setIsCompactMobileLayout(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  const toggleSection = useCallback(
    (section: 'candidates' | 'hold' | 'update' | 'close') => {
      setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    },
    [],
  );

  const openWorkspacePortfolioAction = useCallback(
    (params: { action: 'update-stop' | 'close-position'; ticker: string; positionId: string }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('portfolioAction', params.action);
      searchParams.set('ticker', params.ticker);
      searchParams.set('positionId', params.positionId);
      navigate(`/workspace?${searchParams.toString()}`);
    },
    [navigate],
  );

  return {
    expandedSections,
    toggleSection,
    insightCandidate,
    setInsightCandidate,
    showCreateOrderModal,
    setShowCreateOrderModal,
    selectedCandidate,
    setSelectedCandidate,
    dismissedReadinessBlocker,
    setDismissedReadinessBlocker,
    isCompactMobileLayout,
    watchItemsByTicker,
    watchPending,
    handleWatch,
    handleUnwatch,
    openWorkspacePortfolioAction,
  };
}
