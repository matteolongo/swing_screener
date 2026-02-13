import { useEffect, useMemo, useState } from 'react';
import type { Strategy } from '@/features/strategy/types';
import {
  createStrategyFromDraft,
  useActiveStrategyQuery,
  useCreateStrategyMutation,
  useDeleteStrategyMutation,
  useSetActiveStrategyMutation,
  useStrategiesQuery,
  useUpdateStrategyMutation,
} from '@/features/strategy/hooks';

function cloneStrategy(strategy: Strategy): Strategy {
  return JSON.parse(JSON.stringify(strategy)) as Strategy;
}

function clearStatusLater(setStatus: (value: string | null) => void, mode: string, ms = 2500) {
  if (mode === 'test') return;
  window.setTimeout(() => setStatus(null), ms);
}

export function useStrategyEditor() {
  const strategiesQuery = useStrategiesQuery();
  const activeStrategyQuery = useActiveStrategyQuery();

  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Strategy | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createId, setCreateId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const setActiveMutation = useSetActiveStrategyMutation();

  const updateMutation = useUpdateStrategyMutation((updated) => {
    setDraft(cloneStrategy(updated));
    setStatusMessage('Saved');
    clearStatusLater(setStatusMessage, import.meta.env.MODE, 2000);
  });

  const strategies = strategiesQuery.data ?? [];
  const activeStrategy = activeStrategyQuery.data;

  const createMutation = useCreateStrategyMutation(
    (created) => {
      setSelectedId(created.id);
      setDraft(cloneStrategy(created));
      setCreateId('');
      setCreateName('');
      setCreateDescription('');
      setStatusMessage('Saved as new strategy');
      clearStatusLater(setStatusMessage, import.meta.env.MODE);
    },
    (payload) => createStrategyFromDraft(draft, payload),
  );

  const deleteMutation = useDeleteStrategyMutation(() => {
    setSelectedId('');
    setDraft(null);
    setIsInitialized(false);
    setStatusMessage('Strategy deleted');
    clearStatusLater(setStatusMessage, import.meta.env.MODE);
  });

  useEffect(() => {
    if (isInitialized) return;
    if (activeStrategy) {
      setSelectedId(activeStrategy.id);
      setIsInitialized(true);
      return;
    }
    if (strategies.length) {
      setSelectedId(strategies[0].id);
      setIsInitialized(true);
    }
  }, [activeStrategy, isInitialized, strategies]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedId) ?? null,
    [selectedId, strategies],
  );

  useEffect(() => {
    if (!selectedStrategy) return;
    setDraft(cloneStrategy(selectedStrategy));
  }, [selectedStrategy]);

  const isActive = activeStrategy?.id === selectedStrategy?.id;
  const lowRrWarning = draft ? draft.risk.minRr < 1.5 : false;
  const highFeeWarning = draft ? draft.risk.maxFeeRiskPct > 0.3 : false;

  const normalizedCreateId = createId.trim();
  const normalizedCreateName = createName.trim();
  const idAlreadyExists = strategies.some((strategy) => strategy.id === normalizedCreateId);
  const canCreate =
    !!draft &&
    normalizedCreateId.length > 0 &&
    normalizedCreateName.length > 0 &&
    !idAlreadyExists &&
    !createMutation.isPending;

  const handleSave = () => {
    if (!draft) return;
    updateMutation.mutate(draft);
  };

  const handleReset = () => {
    if (!selectedStrategy) return;
    setDraft(cloneStrategy(selectedStrategy));
    setStatusMessage(null);
  };

  const handleSetActive = () => {
    if (!selectedStrategy) return;
    setActiveMutation.mutate(selectedStrategy.id);
  };

  const handleDelete = () => {
    if (!selectedStrategy || selectedStrategy.isDefault) return;
    const confirmed = window.confirm(`Delete strategy "${selectedStrategy.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteMutation.mutate(selectedStrategy.id);
  };

  const handleCreate = () => {
    if (!draft) return;
    if (!normalizedCreateId || !normalizedCreateName) return;
    const description =
      createDescription.trim().length > 0 ? createDescription.trim() : draft.description;
    createMutation.mutate({
      id: normalizedCreateId,
      name: normalizedCreateName,
      description,
    });
  };

  return {
    activeStrategy,
    canCreate,
    createDescription,
    createId,
    createMutation,
    createName,
    deleteMutation,
    draft,
    handleCreate,
    handleDelete,
    handleReset,
    handleSave,
    handleSetActive,
    highFeeWarning,
    idAlreadyExists,
    isActive,
    lowRrWarning,
    normalizedCreateId,
    normalizedCreateName,
    selectedId,
    selectedStrategy,
    setCreateDescription,
    setCreateId,
    setCreateName,
    setDraft,
    setSelectedId,
    setShowAdvanced,
    showAdvanced,
    statusMessage,
    strategies,
    strategiesQuery,
    updateMutation,
  };
}
