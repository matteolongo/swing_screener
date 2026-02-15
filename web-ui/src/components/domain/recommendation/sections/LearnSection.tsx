import Card from '@/components/common/Card';
import { t } from '@/i18n/t';
import { BookOpen, TrendingUp, Shield, DollarSign } from 'lucide-react';

export default function LearnSection() {
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
