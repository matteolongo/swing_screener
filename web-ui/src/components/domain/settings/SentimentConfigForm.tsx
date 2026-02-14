import { useMemo, useState } from 'react';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';
import Button from '@/components/common/Button';
import HelpTooltip from '@/components/common/HelpTooltip';
import Badge from '@/components/common/Badge';
import type { StrategySocialOverlay } from '@/features/strategy/types';

interface SentimentConfigFormProps {
  onSave?: () => void;
}

const DEFAULT_SOCIAL_OVERLAY: StrategySocialOverlay = {
  enabled: false,
  lookbackHours: 24,
  attentionZThreshold: 3.0,
  minSampleSize: 20,
  negativeSentThreshold: -0.4,
  sentimentConfThreshold: 0.7,
  hypePercentileThreshold: 95.0,
  providers: ['reddit'],
  sentimentAnalyzer: 'keyword',
};

const HELP_PROVIDERS = {
  title: 'Social Data Providers',
  whatIs: 'Select which data sources to use for sentiment analysis',
  why: 'Different providers offer different types of social/news data',
  detail: 'Reddit provides discussion-based sentiment, Yahoo Finance provides news headlines',
  tip: 'Using multiple providers gives a more comprehensive view',
};

const HELP_ANALYZER = {
  title: 'Sentiment Analyzer',
  whatIs: 'The algorithm used to analyze text sentiment',
  why: 'Different analyzers have different accuracy and speed tradeoffs',
  detail: 'Keyword: fast, simple pattern matching. VADER: more sophisticated NLP analysis',
  tip: 'Start with keyword analyzer for speed, upgrade to VADER for accuracy',
};

export default function SentimentConfigForm({ onSave }: SentimentConfigFormProps) {
  const { draft, setDraft, handleSave, updateMutation } = useStrategyEditor();
  const [availableProviders] = useState<string[]>(['reddit', 'yahoo_finance']);
  const [availableAnalyzers] = useState<string[]>(['keyword', 'vader']);

  const socialOverlay = useMemo<StrategySocialOverlay>(() => {
    if (!draft) return DEFAULT_SOCIAL_OVERLAY;
    const overlay = (draft.socialOverlay ?? {}) as Partial<StrategySocialOverlay>;
    const providers =
      Array.isArray(overlay.providers) && overlay.providers.length > 0
        ? overlay.providers
        : DEFAULT_SOCIAL_OVERLAY.providers;

    return {
      ...DEFAULT_SOCIAL_OVERLAY,
      ...overlay,
      providers,
      sentimentAnalyzer: overlay.sentimentAnalyzer ?? DEFAULT_SOCIAL_OVERLAY.sentimentAnalyzer,
    };
  }, [draft]);

  const providers = socialOverlay.providers;
  const analyzer = socialOverlay.sentimentAnalyzer;

  const updateSocialOverlay = (next: Partial<StrategySocialOverlay>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      socialOverlay: {
        ...socialOverlay,
        ...next,
      },
    });
  };

  const toggleProvider = (provider: string) => {
    const newProviders = providers.includes(provider)
      ? providers.filter(p => p !== provider)
      : [...providers, provider];
    
    if (newProviders.length === 0) {
      // Keep at least one provider
      return;
    }

    updateSocialOverlay({ providers: newProviders });
  };

  const setAnalyzer = (newAnalyzer: string) => {
    updateSocialOverlay({ sentimentAnalyzer: newAnalyzer });
  };

  const handleSaveClick = () => {
    handleSave();
    onSave?.();
  };

  if (!draft) {
    return <p className="text-sm text-gray-500">Loading strategy configuration...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Providers Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Social Data Providers
          </label>
          <HelpTooltip
            short={HELP_PROVIDERS.whatIs}
            title={HELP_PROVIDERS.title}
            content={
              <div className="space-y-2 text-sm">
                <p>{HELP_PROVIDERS.whatIs}</p>
                <p>{HELP_PROVIDERS.why}</p>
                <p>{HELP_PROVIDERS.detail}</p>
                <p className="font-medium">{HELP_PROVIDERS.tip}</p>
              </div>
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {availableProviders.map((provider) => {
            const isSelected = providers.includes(provider);
            const displayName = provider === 'yahoo_finance' ? 'Yahoo Finance' : 'Reddit';
            
            return (
              <button
                key={provider}
                type="button"
                onClick={() => toggleProvider(provider)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-900 dark:text-blue-100'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {displayName}
                {isSelected && (
                  <span className="ml-2">✓</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Selected: {providers.map(p => p === 'yahoo_finance' ? 'Yahoo Finance' : 'Reddit').join(', ')}
        </p>
      </div>

      {/* Analyzer Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sentiment Analyzer
          </label>
          <HelpTooltip
            short={HELP_ANALYZER.whatIs}
            title={HELP_ANALYZER.title}
            content={
              <div className="space-y-2 text-sm">
                <p>{HELP_ANALYZER.whatIs}</p>
                <p>{HELP_ANALYZER.why}</p>
                <p>{HELP_ANALYZER.detail}</p>
                <p className="font-medium">{HELP_ANALYZER.tip}</p>
              </div>
            }
          />
        </div>
        <div className="flex gap-2">
          {availableAnalyzers.map((a) => {
            const isSelected = analyzer === a;
            const displayName = a.charAt(0).toUpperCase() + a.slice(1);
            const description = a === 'keyword' ? 'Fast, simple' : 'Advanced NLP';
            
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAnalyzer(a)}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-900 dark:text-blue-100'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium">{displayName}</div>
                  <div className="text-xs opacity-70">{description}</div>
                </div>
                {isSelected && (
                  <span className="ml-2">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Panel */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          Current Configuration
        </h4>
        <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <span className="font-medium">Providers:</span>
            <div className="flex gap-1">
              {providers.map(p => (
                <Badge key={p} variant="primary">
                  {p === 'yahoo_finance' ? 'Yahoo Finance' : 'Reddit'}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Analyzer:</span>
            <Badge variant="primary">
              {analyzer.charAt(0).toUpperCase() + analyzer.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveClick}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
