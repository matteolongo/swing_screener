import { useCallback, useEffect, useState } from 'react';
import {
  useCreateIntelligenceSymbolSetMutation,
  useDeleteIntelligenceSymbolSetMutation,
  useIntelligenceSymbolSetsQuery,
  useUpdateIntelligenceSymbolSetMutation,
} from '@/features/intelligence/hooks';
import type { IntelligenceSymbolSet } from '@/features/intelligence/types';

function normalizeSymbols(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export interface IntelligenceSymbolSetEditorState {
  symbolSets: IntelligenceSymbolSet[];
  selectedSymbolSetId: string;
  setSelectedSymbolSetId: (id: string) => void;
  selectedSymbolSet: IntelligenceSymbolSet | undefined;
  symbolSetName: string;
  setSymbolSetName: (name: string) => void;
  symbolSetSymbolsInput: string;
  setSymbolSetSymbolsInput: (input: string) => void;
  createSymbolSet: () => void;
  updateSymbolSet: () => void;
  deleteSymbolSet: (id: string) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useIntelligenceSymbolSetEditor(): IntelligenceSymbolSetEditorState {
  const symbolSetsQuery = useIntelligenceSymbolSetsQuery();
  const createSymbolSetMutation = useCreateIntelligenceSymbolSetMutation();
  const updateSymbolSetMutation = useUpdateIntelligenceSymbolSetMutation();
  const deleteSymbolSetMutation = useDeleteIntelligenceSymbolSetMutation();

  const [selectedSymbolSetId, setSelectedSymbolSetId] = useState('');
  const [symbolSetName, setSymbolSetName] = useState('');
  const [symbolSetSymbolsInput, setSymbolSetSymbolsInput] = useState('');

  const symbolSets = symbolSetsQuery.data?.items ?? [];
  const selectedSymbolSet = symbolSets.find((item) => item.id === selectedSymbolSetId);

  useEffect(() => {
    if (selectedSymbolSet) {
      setSymbolSetName(selectedSymbolSet.name);
      setSymbolSetSymbolsInput(selectedSymbolSet.symbols.join(', '));
    }
  }, [selectedSymbolSet]);

  const createSymbolSet = useCallback(() => {
    const symbols = normalizeSymbols(symbolSetSymbolsInput);
    if (!symbolSetName.trim() || symbols.length === 0) return;
    createSymbolSetMutation.mutate(
      { name: symbolSetName.trim(), symbols },
      {
        onSuccess: (created) => {
          setSelectedSymbolSetId(created.id);
        },
      },
    );
  }, [symbolSetName, symbolSetSymbolsInput, createSymbolSetMutation]);

  const updateSymbolSet = useCallback(() => {
    if (!selectedSymbolSetId) return;
    const symbols = normalizeSymbols(symbolSetSymbolsInput);
    if (!symbolSetName.trim() || symbols.length === 0) return;
    updateSymbolSetMutation.mutate({
      id: selectedSymbolSetId,
      payload: { name: symbolSetName.trim(), symbols },
    });
  }, [selectedSymbolSetId, symbolSetName, symbolSetSymbolsInput, updateSymbolSetMutation]);

  const deleteSymbolSet = useCallback(
    (id: string) => {
      deleteSymbolSetMutation.mutate(id, {
        onSuccess: () => {
          if (selectedSymbolSetId === id) {
            setSelectedSymbolSetId('');
            setSymbolSetName('');
            setSymbolSetSymbolsInput('');
          }
        },
      });
    },
    [selectedSymbolSetId, deleteSymbolSetMutation],
  );

  return {
    symbolSets,
    selectedSymbolSetId,
    setSelectedSymbolSetId,
    selectedSymbolSet,
    symbolSetName,
    setSymbolSetName,
    symbolSetSymbolsInput,
    setSymbolSetSymbolsInput,
    createSymbolSet,
    updateSymbolSet,
    deleteSymbolSet,
    isCreating: createSymbolSetMutation.isPending,
    isUpdating: updateSymbolSetMutation.isPending,
    isDeleting: deleteSymbolSetMutation.isPending,
  };
}
