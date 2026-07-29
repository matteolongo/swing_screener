import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { useAIStore } from '../../store/useAIStore';
import { useAppStore } from '../../store/useAppStore';
import { useI18n } from '../../i18n';
import TrailStatus from './TrailStatus';
import type { TrailData } from './TrailStatus';
import ExhaustionBadge from './ExhaustionBadge';
import StopPreview from './StopPreview';

interface Props {
  positionId: string | null;
  onClose: () => void;
}

function toTrailData(p: {
  trail_method: string;
  trail_level?: number;
  direction: string;
  entry_price: number;
}): TrailData {
  return {
    method: (['SMA20', 'ATR', 'fixed', 'manual'].includes(p.trail_method)
      ? p.trail_method
      : 'manual') as TrailData['method'],
    level: p.trail_level ?? p.entry_price,
    active: p.trail_method !== '' && p.trail_method !== 'manual',
  };
}

function computeStopPrice(currentPrice: number, distanceToStop: number): number {
  return currentPrice - distanceToStop;
}

function unrealizedPLR(p: {
  direction: string;
  entry_price: number;
  current_price: number;
  rr_to_target: number;
  target_price: number;
}): number {
  if (p.rr_to_target === 0) return 0;
  if (p.direction === 'short') {
    const denom = p.entry_price - p.target_price;
    if (denom === 0) return 0;
    return ((p.entry_price - p.current_price) * p.rr_to_target) / denom;
  }
  const denom = p.target_price - p.entry_price;
  if (denom === 0) return 0;
  return ((p.current_price - p.entry_price) * p.rr_to_target) / denom;
}

export default function PositionDetailPanel({ positionId, onClose }: Props) {
  const { t } = useI18n();
  const positions = usePortfolioStore((s) => s.positions);
  const setActiveSymbol = useAIStore((s) => s.setActiveSymbol);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (positionId) {
      const timer = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(timer);
    }
    setVisible(false);
  }, [positionId]);

  if (!positionId) return null;

  const position = positions.find((p) => p.position_id === positionId);

  const handleBackdropClick = () => {
    setVisible(false);
    setTimeout(() => onClose(), 300);
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 300);
  };

  const handleViewAnalysis = () => {
    if (position) {
      setActiveSymbol(position.ticker);
      setActiveTab('ai');
    }
    handleClose();
  };

  if (!position) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" onClick={handleBackdropClick} />
        <div className="fixed left-0 top-0 w-[400px] h-full bg-surface z-50 border-r border-border shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text-primary">{t('positionDetail.headerTitle')}</h2>
            <button onClick={handleClose} className="text-text-secondary hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-text-secondary">{t('positionDetail.notFound')}</p>
        </div>
      </>
    );
  }

  const stopPrice = computeStopPrice(position.current_price, position.distance_to_stop);
  const plR = unrealizedPLR(position);
  const plDollar = position.unrealized_pl;
  const distToStopPct = position.distance_to_stop;
  const rrToTarget = position.rr_to_target;
  const trailData = toTrailData(position);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleBackdropClick}
      />
      <div
        className="fixed left-0 top-0 w-[400px] h-full bg-surface z-50 border-r border-border shadow-2xl transition-transform duration-300 overflow-y-auto"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div className="p-4 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-text-primary">{position.ticker}</h2>
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                  position.direction === 'long'
                    ? 'bg-success/20 text-success'
                    : 'bg-danger/20 text-danger'
                }`}
              >
                {position.direction === 'long' ? t('positionDetail.long') : t('positionDetail.short')}
              </span>
            </div>
            <div className="text-right">
              <div className={`font-mono text-sm font-medium ${plDollar >= 0 ? 'text-success' : 'text-danger'}`}>
                {plDollar >= 0 ? '+' : ''}${plDollar.toFixed(2)}
              </div>
              <div className={`font-mono text-xs ${plR >= 0 ? 'text-success' : 'text-danger'}`}>
                {plR >= 0 ? '+' : ''}{plR.toFixed(2)}R
              </div>
            </div>
            <button onClick={handleClose} className="text-text-secondary hover:text-text-primary ml-3">
              <X size={16} />
            </button>
          </div>

          {/* Plan */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{t('positionDetail.sections.plan')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.plan.entry')}</div>
                <div className="font-mono text-sm text-text-primary">${position.entry_price.toFixed(2)}</div>
              </div>
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.plan.stop')}</div>
                <div className="font-mono text-sm text-text-primary">${stopPrice.toFixed(2)}</div>
              </div>
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.plan.target')}</div>
                <div className="font-mono text-sm text-text-primary">${position.target_price.toFixed(2)}</div>
              </div>
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.plan.shares')}</div>
                <div className="font-mono text-sm text-text-primary">{position.shares}</div>
              </div>
            </div>
          </div>

          {/* Current Metrics */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{t('positionDetail.sections.metrics')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.metrics.marketValue')}</div>
                <div className="font-mono text-sm text-text-primary">${position.market_value.toFixed(2)}</div>
              </div>
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.metrics.unrealizedPnl')}</div>
                <div className={`font-mono text-sm ${plDollar >= 0 ? 'text-success' : 'text-danger'}`}>
                  {plDollar >= 0 ? '+' : ''}${plDollar.toFixed(2)}
                </div>
              </div>
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.metrics.rrToTarget')}</div>
                <div className="font-mono text-sm text-text-primary">{rrToTarget.toFixed(2)}</div>
              </div>
              <div className="bg-elevated rounded p-2">
                <div className="text-[10px] text-text-secondary">{t('positionDetail.metrics.distToStop')}</div>
                <div className={`font-mono text-sm ${distToStopPct <= 0 ? 'text-danger' : 'text-text-primary'}`}>
                  {distToStopPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Trail Status */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{t('positionDetail.sections.trailStatus')}</h3>
            <TrailStatus trail={trailData} />
          </div>

          {/* Exhaustion */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{t('positionDetail.sections.exhaustion')}</h3>
            <ExhaustionBadge score={position.last_exhaustion_score ?? null} />
          </div>

          {/* Stop Preview */}
          <div>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{t('positionDetail.sections.stopPreview')}</h3>
            <StopPreview
              entry={position.entry_price}
              currentStop={stopPrice}
              currentTarget={position.target_price}
              shares={position.shares}
              direction={position.direction as 'long' | 'short'}
              onClose={() => {}}
            />
          </div>

          {/* Intelligence Link */}
          <button
            onClick={handleViewAnalysis}
            className="w-full flex items-center justify-center gap-2 py-2 rounded bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors text-sm font-medium"
          >
            {t('positionDetail.viewAnalysis')}
            <ExternalLink size={14} />
          </button>

          {/* Close Controls */}
          <div className="space-y-2">
            <p className="text-xs text-text-secondary text-center">
              {t('positionDetail.close.manualNote')}
            </p>
            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 py-2 rounded border border-border text-text-secondary text-sm cursor-not-allowed opacity-60"
              >
                {t('positionDetail.close.closePosition')}
              </button>
              <button
                disabled
                className="flex-1 py-2 rounded border border-border text-text-secondary text-sm cursor-not-allowed opacity-60"
              >
                {t('positionDetail.close.partialClose')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
