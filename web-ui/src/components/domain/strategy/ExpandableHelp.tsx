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
    <div className="mt-2 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left text-sm font-medium text-primary bg-primary/10 hover:bg-primary/10 transition-colors flex items-center justify-between"
        aria-expanded={isExpanded}
      >
        <span>💡 Why this matters</span>
        <span className="text-lg transform transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>
      
      {isExpanded && (
        <div className="px-3 py-3 space-y-3 text-sm bg-surface">
          <div>
            <div className="font-semibold text-muted mb-1">
              What it is:
            </div>
            <div className="text-muted">
              {doc.whatItIs}
            </div>
          </div>

          <div>
            <div className="font-semibold text-muted mb-1">
              Why it matters:
            </div>
            <div className="text-muted">
              {doc.whyItMatters}
            </div>
          </div>

          <div>
            <div className="font-semibold text-muted mb-1">
              How it affects trades:
            </div>
            <div className="text-muted">
              {doc.howItAffectsTrades}
            </div>
          </div>

          <div>
            <div className="font-semibold text-muted mb-1">
              Tradeoffs:
            </div>
            <div className="text-muted space-y-1">
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

          <div className="pt-2 border-t border-border">
            <div className="font-semibold text-success mb-1">
              ✅ Beginner range:
            </div>
            <div className="text-muted">
              {doc.beginnerRange}
            </div>
          </div>

          {doc.defaultGuidance && (
            <div className="bg-success/10 rounded p-2">
              <div className="text-xs font-semibold text-success mb-1">
                💚 Recommended guidance:
              </div>
              <div className="text-xs text-success">
                {doc.defaultGuidance}
              </div>
            </div>
          )}

          {doc.dangerZone && (
            <div className="bg-danger/10 rounded p-2">
              <div className="text-xs font-semibold text-danger mb-1">
                ⚠️ Danger zone:
              </div>
              <div className="text-xs text-danger">
                {doc.dangerZone}
              </div>
            </div>
          )}

          {doc.proTip && (
            <div className="bg-primary/10 rounded p-2">
              <div className="text-xs font-semibold text-primary mb-1">
                🎓 Pro tip:
              </div>
              <div className="text-xs text-primary">
                {doc.proTip}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
