import { useEffect, useMemo, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import StrategyPluginCard from '@/components/domain/strategy/StrategyPluginCard';
import {
  useResolvedStrategyValidationQuery,
  useStrategyConfigQuery,
  useStrategyPluginsQuery,
} from '@/features/strategy/hooks';
import type {
  StrategyPluginCategory,
  StrategyPluginDefinition,
  StrategyPluginResolvedState,
} from '@/features/strategy/types';
import { t } from '@/i18n/t';

const CATEGORY_I18N_KEYS: Partial<Record<StrategyPluginCategory, string>> = {
  filters: 'strategyPage.categories.filters',
  ranking: 'strategyPage.categories.ranking',
  signals: 'strategyPage.categories.signals',
  risk: 'strategyPage.categories.risk',
  qualification: 'strategyPage.categories.qualification',
  management: 'strategyPage.categories.management',
  intelligence: 'strategyPage.categories.intelligence',
  education: 'strategyPage.categories.education',
};

function categoryLabel(category: StrategyPluginCategory): string {
  const key = CATEGORY_I18N_KEYS[category];
  if (key) return t(key as Parameters<typeof t>[0]);
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function warningVariant(level: 'danger' | 'warning' | 'info') {
  if (level === 'danger') return 'error' as const;
  if (level === 'warning') return 'warning' as const;
  return 'default' as const;
}

export default function StrategyPage() {
  const configQuery = useStrategyConfigQuery();
  const pluginsQuery = useStrategyPluginsQuery();
  const validationQuery = useResolvedStrategyValidationQuery();
  const [openPluginId, setOpenPluginId] = useState<string | null>(null);

  const definitionsById = useMemo(() => {
    const map = new Map<string, StrategyPluginDefinition>();
    for (const plugin of pluginsQuery.data ?? []) {
      map.set(plugin.id, plugin);
    }
    return map;
  }, [pluginsQuery.data]);

  const groupedPlugins = useMemo(() => {
    const groups = new Map<string, StrategyPluginResolvedState[]>();
    for (const plugin of configQuery.data?.plugins ?? []) {
      const category = plugin.category ?? 'education';
      const existing = groups.get(category) ?? [];
      existing.push(plugin);
      groups.set(category, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }, [configQuery.data?.plugins]);

  useEffect(() => {
    if (!configQuery.data?.plugins?.length) return;
    if (openPluginId && configQuery.data.plugins.some((plugin) => plugin.id === openPluginId)) return;
    setOpenPluginId(configQuery.data.plugins[0].id);
  }, [configQuery.data?.plugins, openPluginId]);

  if (configQuery.isLoading || pluginsQuery.isLoading || validationQuery.isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Strategy</h1>
        <Card variant="bordered">
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">Loading strategy configuration…</CardContent>
        </Card>
      </div>
    );
  }

  const error = configQuery.error ?? pluginsQuery.error ?? validationQuery.error;
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Strategy</h1>
        <Card variant="bordered">
          <CardContent className="text-sm text-red-600 dark:text-red-300">
            {error instanceof Error ? error.message : 'Failed to load strategy configuration.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = configQuery.data;
  const validation = validationQuery.data;

  if (!config || !validation) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Strategy</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Read-only strategy dashboard backed by YAML plugin configuration.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>{config.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {config.description ? (
              <p className="text-gray-700 dark:text-gray-300">{config.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{config.module}</Badge>
              {config.configPath ? <Badge variant="default">{config.configPath}</Badge> : null}
              <Badge variant="default">{config.plugins.length} plugins</Badge>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Values shown here are resolved from plugin defaults plus root YAML overrides.
            </p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={validation.isValid ? 'success' : 'error'}>
                {validation.isValid ? 'Valid' : 'Needs attention'}
              </Badge>
              <Badge variant="default">Safety score {validation.safetyScore}</Badge>
              <Badge variant="default">{validation.safetyLevel}</Badge>
            </div>
            {validation.warnings.length ? (
              <div className="space-y-2">
                {validation.warnings.map((warning) => (
                  <div
                    key={`${warning.parameter}-${warning.message}`}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={warningVariant(warning.level)}>{warning.level}</Badge>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {warning.parameter}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{warning.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">No validation warnings.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Execution Graph</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            Execution order is resolved from plugin phases plus declared capabilities and dependencies.
          </p>
          {config.executionOrder.length ? (
            <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {config.executionOrder.map((pluginId, index) => {
                const plugin = config.plugins.find((entry) => entry.id === pluginId);
                return (
                  <li
                    key={pluginId}
                    className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {index + 1}. {plugin?.displayName ?? pluginId}
                      </span>
                      <Badge variant="default">{plugin?.phase ?? 'qualification'}</Badge>
                    </div>
                    {plugin?.dependsOn.length ? (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Depends on: {plugin.dependsOn.join(', ')}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-gray-600 dark:text-gray-300">No enabled plugins found.</p>
          )}
        </CardContent>
      </Card>

      {groupedPlugins.map(([category, plugins]) => (
        <section key={category} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{categoryLabel(category)}</h2>
            <Badge variant="default">{plugins.length}</Badge>
          </div>
          <div className="space-y-4">
            {plugins.map((plugin) => (
              <StrategyPluginCard
                key={plugin.id}
                plugin={plugin}
                definition={definitionsById.get(plugin.id)}
                isOpen={openPluginId === plugin.id}
                onToggle={() => setOpenPluginId((current) => (current === plugin.id ? null : plugin.id))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
