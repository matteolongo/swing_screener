import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import type { Dispatch, SetStateAction } from 'react';
import { t } from '@/i18n/t';
import { HelpInfo } from '@/components/domain/strategy/StrategyFieldControls';
import { Strategy } from '@/features/strategy/types';
import TrendSection from '@/components/domain/strategy/advanced/TrendSection';
import VolatilitySection from '@/components/domain/strategy/advanced/VolatilitySection';
import MomentumSection from '@/components/domain/strategy/advanced/MomentumSection';
import RankingWeightsSection from '@/components/domain/strategy/advanced/RankingWeightsSection';
import RiskDetailsSection from '@/components/domain/strategy/advanced/RiskDetailsSection';
import ManageRulesSection from '@/components/domain/strategy/advanced/ManageRulesSection';

interface StrategyAdvancedSettingsCardProps {
  draft: Strategy;
  setDraft: (value: Strategy) => void;
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  lowRrWarning: boolean;
  highFeeWarning: boolean;
  help: Record<string, HelpInfo>;
}

export default function StrategyAdvancedSettingsCard({
  draft,
  setDraft,
  showAdvanced,
  setShowAdvanced,
  lowRrWarning,
  highFeeWarning,
  help,
}: StrategyAdvancedSettingsCardProps) {
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('strategyPage.advanced.title')}</span>
          <Button variant="secondary" onClick={() => setShowAdvanced((prev) => !prev)}>
            {showAdvanced
              ? t('strategyPage.advanced.actions.hide')
              : t('strategyPage.advanced.actions.show')}
          </Button>
        </CardTitle>
      </CardHeader>
      {showAdvanced && (
        <CardContent>
          <div className="space-y-3">
            <TrendSection draft={draft} setDraft={setDraft} help={help} />
            <VolatilitySection draft={draft} setDraft={setDraft} help={help} />
            <MomentumSection draft={draft} setDraft={setDraft} help={help} />
            <RankingWeightsSection draft={draft} setDraft={setDraft} help={help} />
            <RiskDetailsSection
              draft={draft}
              setDraft={setDraft}
              help={help}
              lowRrWarning={lowRrWarning}
              highFeeWarning={highFeeWarning}
            />
            <ManageRulesSection draft={draft} setDraft={setDraft} help={help} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
