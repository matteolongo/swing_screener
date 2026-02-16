import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, CheckCircle } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { useConfigStore } from '@/stores/configStore';
import { isStrategyConfigured } from '@/utils/strategyReadiness';

export default function TodaysNextActionCard() {
  const navigate = useNavigate();
  const { isBeginnerMode, onboardingCompleted } = useUserPreferencesStore();
  const { config } = useConfigStore();
  
  const strategyConfigured = isStrategyConfigured(config);
  
  // Don't show this card in advanced mode
  if (!isBeginnerMode) {
    return null;
  }
  
  // Determine the next action based on state
  const getNextAction = () => {
    if (!strategyConfigured) {
      return {
        title: 'Configure Your Strategy',
        description: 'Set up your risk parameters and trading strategy before reviewing opportunities.',
        icon: CheckCircle,
        buttonLabel: 'Go to Strategy',
        buttonAction: () => navigate('/strategy'),
        priority: 'high' as const,
      };
    }
    
    return {
      title: 'Review Today\'s Opportunities',
      description: 'Check Daily Review for new trade candidates and position management actions.',
      icon: Calendar,
      buttonLabel: 'Open Daily Review',
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
            Today's Next Action
          </CardTitle>
          {nextAction.priority === 'high' && (
            <Badge variant="warning">Action Required</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">{nextAction.title}</h3>
            <p className="text-sm text-gray-600">{nextAction.description}</p>
          </div>
          
          {!onboardingCompleted && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 <strong>First time here?</strong> Complete the onboarding guide to learn the daily workflow.
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
