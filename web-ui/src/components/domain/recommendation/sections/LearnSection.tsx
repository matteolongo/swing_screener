import Card from '@/components/common/Card';
import type { LearnEducationVM } from '@/features/recommendation/educationViewModel';
import { t } from '@/i18n/t';
import { BookOpen, TrendingUp, Shield, DollarSign } from 'lucide-react';

interface LearnSectionProps {
  view?: LearnEducationVM;
}

export default function LearnSection({ view }: LearnSectionProps) {
  if (view) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto text-blue-600 mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {view.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">{view.summary}</p>
          {view.source ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {view.source === 'llm'
                ? t('tradeInsight.education.sourceLlm')
                : t('tradeInsight.education.sourceFallback')}
            </p>
          ) : null}
        </div>

        <Card className="p-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('tradeInsight.education.whyNow')}
          </h4>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {view.concepts.map((concept) => (
              <li key={concept} className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>{concept}</span>
              </li>
            ))}
          </ul>
        </Card>

        {view.watchouts.length ? (
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('tradeInsight.education.watchouts')}
            </h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {view.watchouts.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {view.nextSteps.length ? (
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('tradeInsight.education.nextSteps')}
            </h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {view.nextSteps.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    );
  }

  const glossaryItems = [
    {
      icon: TrendingUp,
      termKey: 'tradeInsight.learn.riskReward.term' as const,
      definitionKey: 'tradeInsight.learn.riskReward.definition' as const,
    },
    {
      icon: Shield,
      termKey: 'tradeInsight.learn.stopLoss.term' as const,
      definitionKey: 'tradeInsight.learn.stopLoss.definition' as const,
    },
    {
      icon: DollarSign,
      termKey: 'tradeInsight.learn.positionSize.term' as const,
      definitionKey: 'tradeInsight.learn.positionSize.definition' as const,
    },
    {
      icon: BookOpen,
      termKey: 'tradeInsight.learn.thesis.term' as const,
      definitionKey: 'tradeInsight.learn.thesis.definition' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <BookOpen className="w-12 h-12 mx-auto text-blue-600 mb-3" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('tradeInsight.learn.title')}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {t('tradeInsight.learn.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {glossaryItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card key={idx} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <Icon size={20} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {t(item.termKey)}
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {t(item.definitionKey)}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('tradeInsight.learn.remember.title')}
        </h4>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>{t('tradeInsight.learn.remember.point1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>{t('tradeInsight.learn.remember.point2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>{t('tradeInsight.learn.remember.point3')}</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
