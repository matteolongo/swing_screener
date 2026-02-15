import { X, TrendingUp, AlertTriangle, Shield, Target, Star } from 'lucide-react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import { TradeThesis, SafetyLabel, SetupQuality } from '@/types/recommendation';

interface TradeThesisModalProps {
  thesis: TradeThesis;
  onClose: () => void;
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

function getSafetyLabelIcon(label: SafetyLabel): string {
  switch (label) {
    case 'BEGINNER_FRIENDLY':
      return '🟢';
    case 'REQUIRES_DISCIPLINE':
      return '🟡';
    case 'ADVANCED_ONLY':
      return '🔴';
  }
}

function getSafetyLabelText(label: SafetyLabel): string {
  switch (label) {
    case 'BEGINNER_FRIENDLY':
      return 'Beginner-Friendly Setup';
    case 'REQUIRES_DISCIPLINE':
      return 'Requires Discipline';
    case 'ADVANCED_ONLY':
      return 'Advanced Traders Only';
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

function getSetupQualityText(tier: SetupQuality): string {
  switch (tier) {
    case 'INSTITUTIONAL':
      return 'Institutional-Grade';
    case 'HIGH_QUALITY':
      return 'High-Quality';
    case 'TRADABLE':
      return 'Tradable';
    case 'WEAK':
      return 'Weak - Educational Only';
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

export default function TradeThesisModal({ thesis, onClose }: TradeThesisModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Trade Thesis: {thesis.ticker}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{thesis.strategy} Strategy</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Setup Score and Safety Label */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Setup Quality Score</h3>
                <Target size={20} className="text-blue-600" />
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900">
                  {thesis.setupQualityScore}
                </span>
                <span className="text-lg text-gray-600">/100</span>
              </div>
              <div className="mt-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSetupQualityColor(
                    thesis.setupQualityTier
                  )}`}
                >
                  {getSetupQualityText(thesis.setupQualityTier)}
                </span>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Trade Safety</h3>
                <Shield size={20} className="text-green-600" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getSafetyLabelIcon(thesis.safetyLabel)}</span>
                <span className="text-lg font-semibold text-gray-900">
                  {getSafetyLabelText(thesis.safetyLabel)}
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
            <h3 className="font-semibold text-gray-900 mb-4">📊 Trade Personality</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Trend Strength</p>
                <StarRating rating={thesis.personality.trendStrength} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Volatility Control</p>
                <StarRating rating={thesis.personality.volatilityRating} />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">System Conviction</p>
                <StarRating rating={thesis.personality.conviction} />
              </div>
            </div>
          </Card>

          {/* Why This Trade Appeared */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-green-600" />
              <h3 className="font-semibold text-gray-900">✅ Why This Trade Appeared</h3>
            </div>
            <ul className="space-y-2">
              {thesis.explanation.whyQualified.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">•</span>
                  <span className="text-gray-700">{reason}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-blue-600">
                👉 This is a {thesis.explanation.setupType}
              </p>
            </div>
          </Card>

          {/* What Could Go Wrong */}
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-yellow-600" />
              <h3 className="font-semibold text-gray-900">⚠️ What Could Go Wrong</h3>
            </div>
            <ul className="space-y-2">
              {thesis.explanation.whatCouldGoWrong.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span className="text-gray-700">{risk}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Key Insight */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-3">💡 Professional Insight</h3>
            <p className="text-gray-700 leading-relaxed">
              {thesis.explanation.keyInsight}
            </p>
            {thesis.professionalInsight && (
              <p className="text-gray-700 leading-relaxed mt-3 pt-3 border-t border-blue-200">
                {thesis.professionalInsight}
              </p>
            )}
          </Card>

          {/* Invalidation Rules */}
          <Card className="p-4 bg-red-50 border-red-200">
            <h3 className="font-semibold text-gray-900 mb-4">
              ❌ This Trade Is No Longer Valid If:
            </h3>
            <ul className="space-y-3">
              {thesis.invalidationRules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5 font-bold">→</span>
                  <div className="flex-1">
                    <p className="text-gray-700">{rule.condition}</p>
                    {rule.threshold !== null && rule.threshold !== undefined && (
                      <p className="text-sm text-gray-600 mt-1">
                        Monitor: {rule.metric} threshold at {rule.threshold}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Trade Characteristics Summary */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">📋 Trade Characteristics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Entry Type</p>
                <p className="text-base font-semibold text-gray-900">{thesis.entryType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trend Status</p>
                <p className="text-base font-semibold text-gray-900">{thesis.trendStatus}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Relative Strength</p>
                <p className="text-base font-semibold text-gray-900">{thesis.relativeStrength}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Volatility</p>
                <p className="text-base font-semibold text-gray-900">{thesis.volatilityState}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk/Reward</p>
                <p className="text-base font-semibold text-gray-900">
                  {thesis.riskReward.toFixed(1)}:1
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Price Action</p>
                <p className="text-base font-semibold text-gray-900">{thesis.priceActionQuality}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Regime Aligned</p>
                <p className="text-base font-semibold text-gray-900">
                  {thesis.regimeAlignment ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Institutional Signal</p>
                <p className="text-base font-semibold text-gray-900">
                  {thesis.institutionalSignal ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              This is transparent, rule-based reasoning. No AI hallucination.
            </p>
            <Button onClick={onClose} variant="primary">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
