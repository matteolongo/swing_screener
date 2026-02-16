import { AppConfig, DEFAULT_CONFIG } from '@/types/config';

/**
 * Check if the user has configured their strategy beyond defaults
 * A configured strategy means the user has set their account size and risk preferences
 */
export function isStrategyConfigured(config: AppConfig): boolean {
  // Check if account size differs from default (50000)
  const hasCustomAccountSize = config.risk.accountSize !== DEFAULT_CONFIG.risk.accountSize;
  
  // Strategy is considered configured if user has changed account size
  // This is the most critical parameter that indicates they've personalized their setup
  return hasCustomAccountSize;
}

/**
 * Get configuration readiness status with detailed feedback
 */
export function getStrategyReadiness(config: AppConfig): {
  isReady: boolean;
  message: string;
  actionRequired: string[];
} {
  const isConfigured = isStrategyConfigured(config);
  
  if (!isConfigured) {
    return {
      isReady: false,
      message: 'Strategy not configured',
      actionRequired: [
        'Set your account size in the Strategy page',
        'Review and adjust risk parameters',
        'Save your configuration',
      ],
    };
  }
  
  return {
    isReady: true,
    message: 'Strategy configured',
    actionRequired: [],
  };
}
