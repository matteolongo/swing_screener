import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle, Calendar, Search } from 'lucide-react';
import Button from '@/components/common/Button';
import OnboardingExecutionSetupCard from '@/components/domain/onboarding/OnboardingExecutionSetupCard';
import { useOnboardingStore } from '@/stores/onboardingStore';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Swing Screener',
    icon: CheckCircle,
    description: 'Learn the workflow before you act on live setups.',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          This quick guide will walk you through the education-first workflow:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li><strong>Learn</strong> the method and glossary</li>
          <li><strong>Practice</strong> trade / wait / avoid decisions on live data</li>
          <li><strong>Review</strong> open positions and past trades as case studies</li>
          <li><strong>Journal</strong> what worked and what needs work</li>
        </ol>
      </div>
    ),
    action: null,
  },
  {
    title: 'Step 1: Learn Your Method',
    icon: CheckCircle,
    description: 'Set up the rules you will study and follow.',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Configure your rules in <strong>Learn → Method Settings</strong>:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li><strong>Account Size</strong>: your capital base</li>
          <li><strong>Risk %</strong>: the loss budget per trade</li>
          <li><strong>Risk/Reward</strong>: the minimum payoff you require</li>
        </ul>
      </div>
    ),
    action: {
      label: 'Open Method Settings',
      path: '/learn/settings',
    },
  },
  {
    title: 'Step 2: Practice the Decision',
    icon: Calendar,
    description: 'Use live setups to decide trade, wait, or avoid.',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          The <strong>Practice</strong> page reveals one setup at a time:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li>Make your own decision first</li>
          <li>Compare it with the system verdict and evidence</li>
          <li>Only place a trade after the execution readback</li>
        </ul>
      </div>
    ),
    action: {
      label: 'Open Practice',
      path: '/practice',
    },
  },
  {
    title: 'Step 3: Review and Journal',
    icon: Search,
    description: 'Turn outcomes into learning, not just activity.',
    content: (
      <div className="space-y-4">
        <p className="text-gray-700">
          Use <strong>Review</strong> and <strong>Journal</strong> to close the loop:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
          <li>Challenge whether each open position still deserves capital</li>
          <li>Study past trades with reflection prompts</li>
          <li>Capture the week’s lesson and next-week focus</li>
        </ul>
        <OnboardingExecutionSetupCard />
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

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissOnboarding();
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [dismissOnboarding, isOpen, onClose]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    dismissOnboarding();
    onClose();
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(stepIndex + 1);
      return;
    }
    completeOnboarding();
    onClose();
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setCurrentStep(stepIndex - 1);
    }
  };

  const handleAction = () => {
    if (!step.action) {
      return;
    }
    navigate(step.action.path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <IconComponent className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{step.title}</h2>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-colors ${index <= stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="mb-4 text-gray-600">{step.description}</p>
          {step.content}
        </div>

        <div className="border-t bg-gray-50 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              {stepIndex > 0 ? (
                <Button variant="secondary" onClick={handleBack}>
                  Back
                </Button>
              ) : null}
            </div>

            <div className="flex gap-3">
              {step.action ? (
                <Button variant="secondary" onClick={handleAction}>
                  {step.action.label}
                </Button>
              ) : null}
              <Button onClick={handleNext}>
                {stepIndex === STEPS.length - 1 ? 'Complete' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
