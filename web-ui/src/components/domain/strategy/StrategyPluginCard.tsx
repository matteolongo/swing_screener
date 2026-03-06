import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import type { StrategyPluginDefinition, StrategyPluginResolvedState } from '@/features/strategy/types';

interface StrategyPluginCardProps {
  plugin: StrategyPluginResolvedState;
  definition?: StrategyPluginDefinition;
}

function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function renderCapabilityGroup(title: string, values: string[]) {
  if (!values.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={`${title}-${value}`} variant="default">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function StrategyPluginCard({ plugin, definition }: StrategyPluginCardProps) {
  const sections = plugin.readOnlySections.length ? plugin.readOnlySections : definition?.readOnlySections ?? [];

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{plugin.displayName}</CardTitle>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {plugin.description || definition?.description || 'No description available.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={plugin.enabled ? 'success' : 'default'}>
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge variant="default">{plugin.phase}</Badge>
          {plugin.enabled !== plugin.defaultEnabled ? (
            <Badge variant="warning">Override</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {renderCapabilityGroup('Provides', plugin.provides)}
          {renderCapabilityGroup('Requires', plugin.requires)}
          {renderCapabilityGroup('Modifies', plugin.modifies)}
          {renderCapabilityGroup('Conflicts', plugin.conflicts)}
          {renderCapabilityGroup('Depends On', plugin.dependsOn)}
        </div>

        {plugin.values.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Field</th>
                  <th className="py-2 pr-4">Default</th>
                  <th className="py-2 pr-4">Effective</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {plugin.values.map((value) => (
                  <tr key={`${plugin.id}-${value.key}`} className="align-top">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{value.label}</div>
                      {value.description ? (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{value.description}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{formatValue(value.defaultValue)}</td>
                    <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">{formatValue(value.effectiveValue)}</td>
                    <td className="py-3">
                      <Badge variant={value.source === 'root_override' ? 'warning' : 'default'}>
                        {value.source === 'root_override' ? 'Root override' : 'Plugin default'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No configuration fields exposed.</p>
        )}

        {sections.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map((section) => (
              <div
                key={`${plugin.id}-${section.title}`}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  {section.title}
                </p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{section.body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
