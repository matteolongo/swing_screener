import { TrendingUp, AlertTriangle, Shield, Target, Star } from 'lucide-react';
import Card from '@/components/common/Card';
import { TradeThesis, SafetyLabel, SetupQuality } from '@/types/recommendation';
import { t } from '@/i18n/t';

interface ThesisSectionProps {
  thesis: TradeThesis;
}

function getSafetyLabelColor(label: SafetyLabel): string {
  switch (label) {
    case 'BEGINNER_FRIENDLY':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'REQUIRES_DISCIPLINE':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'ADVANCED_ONLY':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}

function getSetupQualityColor(tier: SetupQuality): string {
  switch (tier) {
    case 'INSTITUTIONAL':
      return 'text-purple-600 bg-purple-50 border-purple-200';
    case 'HIGH_QUALITY':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'TRADABLE':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    case 'WEAK':
      return 'text-orange-600 bg-orange-50 border-orange-200';
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={16}
          className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

export default function ThesisSection({ thesis }: ThesisSectionProps) {
  return (
    <div className="space-y-6">
      {/* Strategy Header */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {t('tradeThesis.strategyLabel')}: <span className="font-semibold">{thesis.strategy}</span>
      </div>

      {/* Setup Score and Safety Label */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('tradeThesis.setupQuality')}</h3>
            <Target size={20} className="text-blue-600" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {thesis.setupQualityScore}
            </span>
            <span className="text-lg text-gray-600 dark:text-gray-400">/100</span>
          </div>
          <div className="mt-3">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSetupQualityColor(
                thesis.setupQualityTier
              )}`}
            >
              {t(`tradeThesis.setupQualityTier.${thesis.setupQualityTier}`)}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('tradeThesis.tradeSafety')}</h3>
            <Shield size={20} className="text-green-600" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{t(`tradeThesis.safetyIcon.${thesis.safetyLabel}`)}</span>
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t(`tradeThesis.safetyLabel.${thesis.safetyLabel}`)}
            </span>
          </div>
          <div className="mt-3">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSafetyLabelColor(
                thesis.safetyLabel
              )}`}
            >
              {thesis.personality.complexity}
            </span>
          </div>
        </Card>
      </div>

      {/* Trade Personality */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('tradeThesis.personality.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('tradeThesis.personality.trendStrength')}</p>
            <StarRating rating={thesis.personality.trendStrength} />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('tradeThesis.personality.volatilityControl')}</p>
            <StarRating rating={thesis.personality.volatilityRating} />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('tradeThesis.personality.conviction')}</p>
            <StarRating rating={thesis.personality.conviction} />
          </div>
        </div>
      </Card>

      {/* Why This Trade Appeared */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-green-600" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('tradeThesis.whyQualified')}</h3>
        </div>
        <ul className="space-y-2">
          {thesis.explanation.whyQualified.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span className="text-gray-700 dark:text-gray-300">{reason}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {t('tradeThesis.setupType')}: {thesis.explanation.setupType}
          </p>
        </div>
      </Card>

      {/* What Could Go Wrong */}
      <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-yellow-600" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('tradeThesis.whatCouldGoWrong')}</h3>
        </div>
        <ul className="space-y-2">
          {thesis.explanation.whatCouldGoWrong.map((risk, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-yellow-600 mt-0.5">•</span>
              <span className="text-gray-700 dark:text-gray-300">{risk}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Key Insight */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('tradeThesis.keyInsight')}</h3>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
          {thesis.explanation.keyInsight}
        </p>
        {thesis.professionalInsight && (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            {thesis.professionalInsight}
          </p>
        )}
      </Card>

      {/* Invalidation Rules */}
      <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('tradeThesis.invalidation')}
        </h3>
        <ul className="space-y-3">
          {thesis.invalidationRules.map((rule, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-red-600 mt-0.5 font-bold">→</span>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300">{rule.condition}</p>
                {rule.threshold !== null && rule.threshold !== undefined && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('tradeThesis.monitor')}: {rule.metric} {t('tradeThesis.thresholdAt')} {rule.threshold}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Trade Characteristics Summary */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('tradeThesis.characteristics')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.entryType')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{thesis.entryType}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.trendStatus')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{thesis.trendStatus}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.relativeStrength')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{thesis.relativeStrength}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.volatility')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{thesis.volatilityState}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.riskReward')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {thesis.riskReward.toFixed(1)}:1
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.priceAction')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{thesis.priceActionQuality}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.regimeAligned')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {thesis.regimeAlignment ? t('common.yes') : t('common.no')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('tradeThesis.fields.institutionalSignal')}</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {thesis.institutionalSignal ? t('common.yes') : t('common.no')}
            </p>
          </div>
        </div>
      </Card>

      {/* Footer Note */}
      <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
        {t('tradeThesis.transparencyNote')}
      </div>
    </div>
  );
}
