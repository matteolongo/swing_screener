import Card, { CardContent } from '@/components/common/Card';

interface SummaryCardProps {
  title: string;
  value: number;
  variant: 'blue' | 'yellow' | 'red' | 'green' | 'gray';
  icon: string;
}

const VARIANT_CLASSES: Record<SummaryCardProps['variant'], string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
};

export default function DailyReviewSummaryCard({ title, value, variant, icon }: SummaryCardProps) {
  return (
    <Card className={VARIANT_CLASSES[variant]}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <span className="text-4xl">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}
