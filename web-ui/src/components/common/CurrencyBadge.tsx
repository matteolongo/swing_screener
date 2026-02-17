import Badge from './Badge';

interface CurrencyBadgeProps {
  currency: string;
  className?: string;
}

export default function CurrencyBadge({ currency, className = '' }: CurrencyBadgeProps) {
  const upperCurrency = currency.toUpperCase();
  
  // Blue for USD, orange for EUR, gray for others
  const variant = upperCurrency === 'USD' ? 'primary' : upperCurrency === 'EUR' ? 'warning' : 'default';
  
  return (
    <Badge variant={variant} className={`text-xs font-mono ${className}`}>
      {upperCurrency}
    </Badge>
  );
}
