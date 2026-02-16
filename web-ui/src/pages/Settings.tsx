import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/stores/configStore';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import IndicatorConfigForm from '@/components/domain/settings/IndicatorConfigForm';
import ManageConfigForm from '@/components/domain/settings/ManageConfigForm';
import SentimentConfigForm from '@/components/domain/settings/SentimentConfigForm';
import LLMConfigForm from '@/components/domain/settings/LLMConfigForm';
import { t } from '@/i18n/t';

export default function Settings() {
  const { resetToDefaults } = useConfigStore();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('settingsPage.header.title')}</h1>
        <Button variant="secondary" onClick={resetToDefaults}>
          {t('settingsPage.header.reset')}
        </Button>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('settingsPage.sections.accountRisk.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>{t('settingsPage.sections.accountRisk.message')}</p>
            <Button variant="secondary" onClick={() => navigate('/strategy')}>
              {t('settingsPage.sections.accountRisk.goToStrategy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('settingsPage.sections.technicalIndicators.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <IndicatorConfigForm />
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('settingsPage.sections.positionManagement.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ManageConfigForm />
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Sentiment Analysis Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <SentimentConfigForm />
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>LLM Intelligence Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <LLMConfigForm />
        </CardContent>
      </Card>
    </div>
  );
}
