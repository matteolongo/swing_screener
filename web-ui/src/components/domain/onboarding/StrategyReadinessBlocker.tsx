import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';

interface StrategyReadinessBlockerProps {
  onDismiss?: () => void;
}

export default function StrategyReadinessBlocker({ onDismiss }: StrategyReadinessBlockerProps) {
  const navigate = useNavigate();
  
  return (
    <Card className="border-l-4 border-l-amber-500 bg-amber-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Strategy Configuration Required
          </CardTitle>
          <Badge variant="warning">Action Required</Badge>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-700">
            Before you can review trade opportunities, you need to configure your trading strategy.
          </p>
          
          <div className="bg-white rounded-lg p-4 border border-amber-200">
            <h4 className="font-medium text-gray-900 mb-2">Required Setup:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li>Set your account size</li>
              <li>Configure risk percentage per trade</li>
              <li>Review risk/reward ratios</li>
            </ul>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={() => navigate('/strategy')}
              className="flex items-center gap-2"
            >
              Go to Strategy Configuration
              <ArrowRight className="w-4 h-4" />
            </Button>
            
            {onDismiss && (
              <Button variant="secondary" onClick={onDismiss}>
                I'll Complete This Later
              </Button>
            )}
          </div>
          
          <p className="text-xs text-gray-600">
            💡 <strong>Tip:</strong> This only takes a minute and ensures accurate position sizing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
