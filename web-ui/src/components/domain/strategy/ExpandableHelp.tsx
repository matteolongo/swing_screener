/**
 * ExpandableHelp - Progressive disclosure component for parameter education
 * Implements Layer 2 (Expandable Explanation) from the education strategy
 */
import { useState } from 'react';
import type { ParameterDocumentation } from '@/content/strategy_docs/types';

interface ExpandableHelpProps {
  doc: ParameterDocumentation;
}

export default function ExpandableHelp({ doc }: ExpandableHelpProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-between"
        aria-expanded={isExpanded}
      >
        <span>💡 Why this matters</span>
        <span className="text-lg transform transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>
      
      {isExpanded && (
        <div className="px-3 py-3 space-y-3 text-sm bg-white dark:bg-gray-800">
          <div>
            <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
              What it is:
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {doc.whatItIs}
            </div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Why it matters:
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {doc.whyItMatters}
            </div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
              How it affects trades:
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {doc.howItAffectsTrades}
            </div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Tradeoffs:
            </div>
            <div className="text-gray-600 dark:text-gray-400 space-y-1">
              {doc.tradeoffs.lower && (
                <div>• Lower: {doc.tradeoffs.lower}</div>
              )}
              {doc.tradeoffs.higher && (
                <div>• Higher: {doc.tradeoffs.higher}</div>
              )}
              {doc.tradeoffs.looseFilter && (
                <div>• Loose filter: {doc.tradeoffs.looseFilter}</div>
              )}
              {doc.tradeoffs.strictFilter && (
                <div>• Strict filter: {doc.tradeoffs.strictFilter}</div>
              )}
              {doc.tradeoffs.recentHeavy && (
                <div>• Recent-heavy: {doc.tradeoffs.recentHeavy}</div>
              )}
              {doc.tradeoffs.longTermHeavy && (
                <div>• Long-term heavy: {doc.tradeoffs.longTermHeavy}</div>
              )}
              {doc.tradeoffs.earlier && (
                <div>• Earlier: {doc.tradeoffs.earlier}</div>
              )}
              {doc.tradeoffs.later && (
                <div>• Later: {doc.tradeoffs.later}</div>
              )}
              {doc.tradeoffs.enabled && (
                <div>• Enabled: {doc.tradeoffs.enabled}</div>
              )}
              {doc.tradeoffs.disabled && (
                <div>• Disabled: {doc.tradeoffs.disabled}</div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="font-semibold text-green-700 dark:text-green-400 mb-1">
              ✅ Beginner range:
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {doc.beginnerRange}
            </div>
          </div>

          {doc.defaultGuidance && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
              <div className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1">
                💚 Recommended guidance:
              </div>
              <div className="text-xs text-green-700 dark:text-green-400">
                {doc.defaultGuidance}
              </div>
            </div>
          )}

          {doc.dangerZone && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
              <div className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                ⚠️ Danger zone:
              </div>
              <div className="text-xs text-red-700 dark:text-red-400">
                {doc.dangerZone}
              </div>
            </div>
          )}

          {doc.proTip && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
              <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                🎓 Pro tip:
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400">
                {doc.proTip}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
