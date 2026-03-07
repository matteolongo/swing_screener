import type { ReactNode } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { t } from '@/i18n/t';

interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
  variant?: 'warning' | 'danger';
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  count,
  variant,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>{title}</CardTitle>
            {count > 0 && variant === 'warning' ? (
              <Badge variant="warning">
                {t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' })}
              </Badge>
            ) : null}
            {count > 0 && variant === 'danger' ? (
              <Badge variant="error">
                {t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' })}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            title={isExpanded ? t('dailyReview.sections.collapse') : t('dailyReview.sections.expand')}
            aria-label={isExpanded ? t('dailyReview.sections.collapse') : t('dailyReview.sections.expand')}
          >
            {isExpanded ? '▼' : '▶'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
