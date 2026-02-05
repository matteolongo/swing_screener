import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useConfigStore } from '@/stores/configStore';
import { formatCurrency } from '@/utils/formatters';
import { TrendingUp, AlertCircle, FileText } from 'lucide-react';

export default function Dashboard() {
  const { config } = useConfigStore();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Portfolio Summary */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Account Size</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(config.risk.accountSize)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Open Positions</p>
              <p className="text-2xl font-bold mt-1">0</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold mt-1">$0</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Available Capital</p>
              <p className="text-2xl font-bold mt-1 text-success">{formatCurrency(config.risk.accountSize)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Today's Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <AlertCircle className="w-5 h-5" />
            <p>No action items. You're all caught up!</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="primary" className="h-20 text-lg">
              <div className="flex flex-col items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                <span>Run Screener</span>
              </div>
            </Button>
            <Button variant="secondary" className="h-20 text-lg">
              <div className="flex flex-col items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                <span>Manage Positions</span>
              </div>
            </Button>
            <Button variant="secondary" className="h-20 text-lg">
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-6 h-6" />
                <span>View Orders</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card variant="bordered" className="bg-primary/5">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Welcome to Swing Screener! Here's what to do next:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Review and customize your <a href="/settings" className="text-primary underline">Settings</a> (risk parameters, indicators)</li>
            <li>Run the Screener to find trade candidates</li>
            <li>Create orders for your best setups</li>
            <li>Track positions and manage stops</li>
          </ol>
          <div className="bg-warning/10 border border-warning/30 rounded p-4 mt-4">
            <p className="text-sm font-semibold text-warning-foreground">💡 First Time User?</p>
            <p className="text-sm mt-2">
              Hover over the <span className="inline-flex"><HelpCircle className="w-4 h-4" /></span> icons throughout the app 
              to learn about each concept. Click them for detailed explanations with formulas and examples.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Import HelpCircle just for the visual reference
import { HelpCircle } from 'lucide-react';
