import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import HelpTooltip from '@/components/common/HelpTooltip';
import {
  ALL_GLOSSARY_KEYS,
  getGlossaryEntry,
  getGlossarySection,
  type EducationGlossarySection,
} from '@/content/educationGlossary';
import { t } from '@/i18n/t';

const SECTION_ORDER: EducationGlossarySection[] = ['setup', 'risk', 'overlay', 'review'];
const SECTION_LABEL_KEY: Record<EducationGlossarySection, 'learnPage.sections.setup' | 'learnPage.sections.risk' | 'learnPage.sections.overlay' | 'learnPage.sections.review'> = {
  setup: 'learnPage.sections.setup',
  risk: 'learnPage.sections.risk',
  overlay: 'learnPage.sections.overlay',
  review: 'learnPage.sections.review',
};

export default function LearnPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    const searchFromUrl = searchParams.get('q') ?? '';
    setSearch((current) => (current === searchFromUrl ? current : searchFromUrl));
  }, [searchParams]);

  const glossaryEntries = useMemo(
    () => ALL_GLOSSARY_KEYS.map((metricKey) => ({ metricKey, entry: getGlossaryEntry(metricKey), section: getGlossarySection(metricKey) })),
    []
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedSearch) {
      return glossaryEntries;
    }

    return glossaryEntries.filter(({ entry }) => entry.label.toLowerCase().includes(normalizedSearch));
  }, [glossaryEntries, normalizedSearch]);

  const groupedEntries = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        items: filteredEntries.filter((entry) => entry.section === section),
      })).filter((group) => group.items.length > 0),
    [filteredEntries]
  );

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);
    if (value.trim()) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{t('learnPage.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('learnPage.subtitle')}</p>
      </div>

      <Card variant="bordered">
        <CardContent className="space-y-3 pt-5">
          <label className="block text-sm font-medium" htmlFor="learn-search">
            {t('learnPage.search.label')}
          </label>
          <input
            id="learn-search"
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder={t('learnPage.search.placeholder')}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary dark:bg-gray-800"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('learnPage.search.summary', { count: filteredEntries.length })}
          </div>
        </CardContent>
      </Card>

      {groupedEntries.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="py-6 text-sm text-gray-600 dark:text-gray-300">
            {t('learnPage.search.empty')}
          </CardContent>
        </Card>
      ) : null}

      {groupedEntries.map(({ section, items }) => (
        <Card variant="bordered" key={section}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{t(SECTION_LABEL_KEY[section])}</CardTitle>
            <Link
              to="/workspace"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('learnPage.backToWorkspace')}
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map(({ metricKey, entry }) => (
                <div
                  key={metricKey}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {entry.label}
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{entry.title}</p>
                    </div>
                    <HelpTooltip
                      short={entry.tooltip}
                      title={entry.title}
                      content={(
                        <div className="space-y-3 text-sm">
                          <p>{entry.explanation}</p>
                          {entry.formula ? (
                            <p className="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                              {entry.formula}
                            </p>
                          ) : null}
                          <p>{entry.interpretation}</p>
                        </div>
                      )}
                    />
                  </div>

                  <p className="mt-2 text-gray-700 dark:text-gray-300">{entry.tooltip}</p>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{entry.explanation}</p>
                  {entry.formula ? (
                    <p className="mt-2 rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-700">
                      {entry.formula}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{entry.interpretation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
