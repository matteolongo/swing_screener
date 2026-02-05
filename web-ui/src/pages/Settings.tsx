import { useConfigStore } from '@/stores/configStore';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import RiskConfigForm from '@/components/domain/settings/RiskConfigForm';
import IndicatorConfigForm from '@/components/domain/settings/IndicatorConfigForm';
import ManageConfigForm from '@/components/domain/settings/ManageConfigForm';

export default function Settings() {
  const { resetToDefaults } = useConfigStore();

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
          <RiskConfigForm />
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
