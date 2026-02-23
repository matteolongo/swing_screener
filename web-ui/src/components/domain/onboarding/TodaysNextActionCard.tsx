import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, CheckCircle } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useStrategyReadiness } from '@/features/strategy/useStrategyReadiness';
import { t } from '@/i18n/t';

interface TodaysNextActionCardProps {
  onRunScreener?: () => void;
}

export default function TodaysNextActionCard({ onRunScreener }: TodaysNextActionCardProps = {}) {
  const navigate = useNavigate();
  const { status: onboardingStatus } = useOnboardingStore();
  const { isBeginnerMode } = useBeginnerModeStore();
  const { isReady: strategyReady } = useStrategyReadiness();
  
  // Don't show this card in advanced mode
  if (!isBeginnerMode) {
    return null;
  }
  
  // Determine the next action based on state
  const getNextAction = () => {
    if (!strategyReady) {
      return {
        title: t('todaysNextActionCard.configureStrategy.title'),
        description: t('todaysNextActionCard.configureStrategy.description'),
        icon: CheckCircle,
        buttonLabel: t('todaysNextActionCard.configureStrategy.buttonLabel'),
        buttonAction: () => navigate('/strategy'),
        priority: 'high' as const,
      };
    }
    
    if (onRunScreener) {
      return {
        title: t('todaysNextActionCard.runScreener.title'),
        description: t('todaysNextActionCard.runScreener.description'),
        icon: Calendar,
        buttonLabel: t('todaysNextActionCard.runScreener.buttonLabel'),
        buttonAction: onRunScreener,
        priority: 'normal' as const,
      };
    }

    return {
      title: t('todaysNextActionCard.reviewOpportunities.title'),
      description: t('todaysNextActionCard.reviewOpportunities.description'),
      icon: Calendar,
      buttonLabel: t('todaysNextActionCard.reviewOpportunities.buttonLabel'),
      buttonAction: () => navigate('/daily-review'),
      priority: 'normal' as const,
    };
  };
  
  const nextAction = getNextAction();
  const IconComponent = nextAction.icon;
  
  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5 text-blue-600" />
            {t('todaysNextActionCard.cardTitle')}
          </CardTitle>
          {nextAction.priority === 'high' && (
            <Badge variant="warning">{t('todaysNextActionCard.actionRequired')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">{nextAction.title}</h3>
            <p className="text-sm text-gray-600">{nextAction.description}</p>
          </div>
          
          {onboardingStatus !== 'completed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 {t('todaysNextActionCard.firstTimeHint')}
              </p>
            </div>
          )}
          
          <Button
            onClick={nextAction.buttonAction}
            className="w-full flex items-center justify-center gap-2"
          >
            {nextAction.buttonLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
