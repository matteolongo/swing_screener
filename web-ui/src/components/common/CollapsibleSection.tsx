import type { ReactNode } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';

interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
  variant?: 'warning' | 'danger';
  badgeLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  count,
  variant,
  badgeLabel,
  expandLabel = '▶',
  collapseLabel = '▼',
  children,
}: CollapsibleSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>{title}</CardTitle>
            {count > 0 && variant === 'warning' && badgeLabel ? (
              <Badge variant="warning">{badgeLabel}</Badge>
            ) : null}
            {count > 0 && variant === 'danger' && badgeLabel ? (
              <Badge variant="error">{badgeLabel}</Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            title={isExpanded ? collapseLabel : expandLabel}
            aria-label={isExpanded ? collapseLabel : expandLabel}
          >
            {isExpanded ? collapseLabel : expandLabel}
          </Button>
        </div>
      </CardHeader>
      {isExpanded ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
