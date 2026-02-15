/**
 * Loader for strategy documentation
 */
import type { StrategyDocumentation } from './types';
import momentumDocs from './momentum.json';

const strategyDocsMap: Record<string, StrategyDocumentation> = {
  momentum: momentumDocs as StrategyDocumentation,
};

/**
 * Load strategy documentation for a given strategy module
 */
export function loadStrategyDocs(module: string): StrategyDocumentation | null {
  return strategyDocsMap[module] || null;
}

/**
 * Get documentation for a specific parameter
 */
export function getParameterDoc(module: string, parameterKey: string) {
  const docs = loadStrategyDocs(module);
  return docs?.parameters[parameterKey] || null;
}

/**
 * Get strategy overview information
 */
export function getStrategyInfo(module: string) {
  const docs = loadStrategyDocs(module);
  return docs?.strategy || null;
}
