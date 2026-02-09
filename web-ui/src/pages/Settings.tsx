import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '@/stores/configStore';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import IndicatorConfigForm from '@/components/domain/settings/IndicatorConfigForm';
import ManageConfigForm from '@/components/domain/settings/ManageConfigForm';

export default function Settings() {
  const { resetToDefaults } = useConfigStore();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button variant="secondary" onClick={resetToDefaults}>
          Reset to Defaults
        </Button>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Account & Risk Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>Risk settings and account sizing now live in the Strategy page.</p>
            <Button variant="secondary" onClick={() => navigate('/strategy')}>
              Go to Strategy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Technical Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <IndicatorConfigForm />
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Position Management Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <ManageConfigForm />
        </CardContent>
      </Card>
    </div>
  );
}
