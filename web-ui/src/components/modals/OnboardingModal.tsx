import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle, Calendar, Search, ShoppingCart } from 'lucide-react';
import Button from '@/components/common/Button';
import { useOnboardingStore } from '@/stores/onboardingStore';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Swing Screener',
    icon: CheckCircle,
    description: 'Let\'s get you set up for successful swing trading',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          This quick guide will walk you through your daily workflow:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li><strong>Configure</strong> your strategy and risk parameters</li>
          <li><strong>Review</strong> daily trade opportunities</li>
          <li><strong>Act</strong> on recommendations (or acknowledge no action)</li>
          <li><strong>Verify</strong> your orders and positions</li>
        </ol>
        <p className="text-sm text-gray-600 mt-4">
          You can complete this guide even on no-trade days.
        </p>
      </div>
    ),
    action: null,
  },
  {
    title: 'Step 1: Configure Strategy & Risk',
    icon: CheckCircle,
    description: 'Set up your trading parameters',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Before you start trading, configure your strategy on the <strong>Strategy</strong> page:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li><strong>Account Size</strong>: Your total capital</li>
          <li><strong>Risk %</strong>: Percentage to risk per trade (typically 1%)</li>
          <li><strong>Risk/Reward</strong>: Minimum R:R ratio (e.g., 2:1)</li>
        </ul>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Start with beginner-friendly defaults and adjust as you gain experience.
          </p>
        </div>
      </div>
    ),
    action: {
      label: 'Go to Strategy',
      path: '/strategy',
    },
  },
  {
    title: 'Step 2: Open Daily Review',
    icon: Calendar,
    description: 'Your primary surface for daily decisions',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          The <strong>Daily Review</strong> page combines screener results with position management:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li><strong>New Candidates</strong>: Potential trades ranked by quality</li>
          <li><strong>Positions to Hold</strong>: Current trades performing well</li>
          <li><strong>Positions to Update</strong>: Stop-loss adjustments needed</li>
          <li><strong>Positions to Close</strong>: Trades hitting exit criteria</li>
        </ul>
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mt-4">
          <p className="text-sm text-amber-800">
            ⚠️ Daily Review requires a configured strategy. Complete Step 1 first.
          </p>
        </div>
      </div>
    ),
    action: {
      label: 'Go to Daily Review',
      path: '/daily-review',
    },
  },
  {
    title: 'Step 3: Complete Action or Acknowledge No Action',
    icon: ShoppingCart,
    description: 'Act on recommendations (or note no action today)',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          After reviewing opportunities, you have three options:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li><strong>Create Order</strong>: Place a trade for a recommended candidate</li>
          <li><strong>Update Position</strong>: Adjust stops or take action on existing trades</li>
          <li><strong>No Action Today</strong>: Mark the review as complete with no trades</li>
        </ul>
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mt-4">
          <p className="text-sm text-green-800">
            ✅ <strong>Remember:</strong> Not every day requires action. The system is designed for selective trading.
          </p>
        </div>
      </div>
    ),
    action: null,
  },
  {
    title: 'Step 4: Verify Orders & Positions',
    icon: Search,
    description: 'Review your orders and open positions',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Finally, verify your trades on the <strong>Orders</strong> and <strong>Positions</strong> pages:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li><strong>Orders Page</strong>: View pending orders and mark them as filled</li>
          <li><strong>Positions Page</strong>: Track open positions, P&L, and stop-loss levels</li>
        </ul>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Best Practice:</strong> Execute orders manually through your broker, then update status in the app.
          </p>
        </div>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-center text-gray-700 font-medium">
            🎉 You're ready to start systematic swing trading!
          </p>
        </div>
      </div>
    ),
    action: null,
  },
];

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const navigate = useNavigate();
  const { currentStep, setCurrentStep, completeOnboarding, dismissOnboarding } = useOnboardingStore();
  
  const stepIndex = Math.min(currentStep, STEPS.length - 1);
  const step = STEPS[stepIndex];
  const IconComponent = step.icon;
  
  // Handle escape key - using stable refs to avoid recreating handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissOnboarding();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, dismissOnboarding, onClose]);
  
  if (!isOpen) return null;
  
  const handleDismiss = () => {
    dismissOnboarding();
    onClose();
  };
  
  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(stepIndex + 1);
    } else {
      handleComplete();
    }
  };
  
  const handleBack = () => {
    if (stepIndex > 0) {
      setCurrentStep(stepIndex - 1);
    }
  };
  
  const handleComplete = () => {
    completeOnboarding();
    onClose();
  };
  
  const handleAction = () => {
    if (step.action) {
      navigate(step.action.path);
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <IconComponent className="h-5 w-5 text-blue-600 sm:h-6 sm:w-6" />
            <h2 className="text-base font-semibold text-gray-900 sm:text-xl">{step.title}</h2>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Progress indicator */}
        <div className="px-4 pt-4 sm:px-6">
          <div className="flex gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  index <= stepIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <p className="text-gray-600 mb-4">{step.description}</p>
          {step.content}
        </div>
        
        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {stepIndex > 0 && (
                <Button variant="secondary" onClick={handleBack}>
                  Back
                </Button>
              )}
            </div>
            
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              {step.action && (
                <Button variant="secondary" onClick={handleAction}>
                  {step.action.label}
                </Button>
              )}
              
              <Button onClick={handleNext}>
                {stepIndex === STEPS.length - 1 ? 'Complete' : 'Next'}
              </Button>
            </div>
          </div>
          
          {stepIndex === 0 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              You can resume this guide anytime from the Getting Started button in the header.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
