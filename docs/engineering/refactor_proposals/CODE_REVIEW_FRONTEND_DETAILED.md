# Frontend Code Review - Detailed Analysis
**Date:** 2026-02-15  
**Status Update:** 2026-02-16  
**Scope:** TypeScript/React frontend in `web-ui/src/`

---

## ⚠️ STATUS UPDATE (2026-02-16)

**Regression Alert:**
- 🔴 **Screener.tsx WORSE:** 685 → 904 lines (+32%)
- 🔴 **useState hooks WORSE:** 14 → 17 hooks (+21%)
- 🔴 **localStorage calls WORSE:** 19 → 23 in Screener.tsx (+21%)

**Progress:**
- ✅ **Fixed:** ScreenerCandidatesTable optimization
- ❌ **Critical Unfixed:** No custom hooks created (hooks/ directory doesn't exist)
- ❌ **Blocker:** Must create hooks before refactoring pages

**Priority:**
1. **Week 1:** Create hooks directory + 3 essential hooks (22h)
2. **Weeks 2-3:** Refactor Screener.tsx using new hooks (36h)
3. **Week 4:** Apply patterns to other pages (16h)

---

## 🔴 CRITICAL ISSUES

### 1. Excessive Local State in Page Components
**Files:** 
- `pages/Screener.tsx` (17 useState hooks, 904 lines) - **WORSE**
- `pages/Dashboard.tsx` (6+ useState hooks, 503 lines)
- `pages/Positions.tsx` (311 lines)

**Severity:** HIGH → **CRITICAL** (Component growing, not shrinking)  
**Impact:** Hard to test, stale closure bugs, fragile useEffect dependencies  
**Status:** ❌ **UNFIXED - REGRESSED**

**Current Code (Screener.tsx - Verified 2026-02-16):**
Lines 94-115+ show localStorage-based useState initialization:
```typescript
const [selectedUniverse, setSelectedUniverse] = useState<string>(() => {...});
const [topN, setTopN] = useState<number>(() => {...});
const [minPrice, setMinPrice] = useState<number>(() => {...});
const [maxPrice, setMaxPrice] = useState<number>(() => {...});
const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>(() => {...});
const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
const [showBacktestModal, setShowBacktestModal] = useState(false);
const [selectedCandidate, setSelectedCandidate] = useState<ScreenerCandidate | null>(null);
const [socialSymbol, setSocialSymbol] = useState<string | null>(null);
const [insightCandidate, setInsightCandidate] = useState<ScreenerCandidate | null>(null);
const [insightDefaultTab, setInsightDefaultTab] = useState<'recommendation' | 'thesis' | 'learn'>('recommendation');
const [intelligenceJobId, setIntelligenceJobId] = useState<string | null>(null);
const [intelligenceAsofDate, setIntelligenceAsofDate] = useState<string | null>(() => {...});
const [intelligenceSymbols, setIntelligenceSymbols] = useState<string[]>(() => {...});
// ... 3 more hooks!

// PLUS: 23 localStorage access points scattered throughout the 904 lines
```

**Component Size:** 904 lines (was 685, now +32% larger)  
**localStorage calls:** 23 instances (was 19, now +21%)

**Problems:**
1. State scattered across 14 separate hooks
2. Complex interdependencies
3. Stale closure bugs in callbacks
4. Difficult to test state transitions
5. No clear state machine
6. Hard to reason about component behavior

**Solution - Extract Custom Hooks:**

```typescript
// Create hooks/useScreenerForm.ts
interface ScreenerFormState {
  universe: string;
  topN: number;
  minPrice: number;
  maxPrice: number;
  currencyFilter: CurrencyFilter;
}

export function useScreenerForm() {
  const [form, setForm] = useState<ScreenerFormState>(() => {
    const saved = localStorage.getItem('screener.form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to defaults
      }
    }
    return {
      universe: 'mega_all',
      topN: 20,
      minPrice: 5,
      maxPrice: 500,
      currencyFilter: 'all'
    };
  });
  
  useEffect(() => {
    localStorage.setItem('screener.form', JSON.stringify(form));
  }, [form]);
  
  const updateForm = useCallback((updates: Partial<ScreenerFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetForm = useCallback(() => {
    setForm({
      universe: 'mega_all',
      topN: 20,
      minPrice: 5,
      maxPrice: 500,
      currencyFilter: 'all'
    });
  }, []);
  
  return { form, updateForm, resetForm };
}

// IMPORTANT NOTE (2026-02-16): 
// The web-ui/src/hooks/ directory DOES NOT EXIST yet.
// This hook (and all others below) must be created as part of the refactor.

// Create hooks/useScreenerModals.ts
interface ScreenerModals {
  createOrder: ScreenerCandidate | null;
  backtest: ScreenerCandidate | null;
  social: string | null;
  insight: {
    candidate: ScreenerCandidate;
    defaultTab: 'recommendation' | 'thesis' | 'learn';
  } | null;
}

export function useScreenerModals() {
  const [modals, setModals] = useState<ScreenerModals>({
    createOrder: null,
    backtest: null,
    social: null,
    insight: null
  });
  
  const openCreateOrder = useCallback((candidate: ScreenerCandidate) => {
    setModals(m => ({ ...m, createOrder: candidate }));
  }, []);
  
  const openBacktest = useCallback((candidate: ScreenerCandidate) => {
    setModals(m => ({ ...m, backtest: candidate }));
  }, []);
  
  const openSocial = useCallback((ticker: string) => {
    setModals(m => ({ ...m, social: ticker }));
  }, []);
  
  const openInsight = useCallback((
    candidate: ScreenerCandidate,
    defaultTab: 'recommendation' | 'thesis' | 'learn' = 'recommendation'
  ) => {
    setModals(m => ({ ...m, insight: { candidate, defaultTab } }));
  }, []);
  
  const closeAll = useCallback(() => {
    setModals({
      createOrder: null,
      backtest: null,
      social: null,
      insight: null
    });
  }, []);
  
  return {
    modals,
    openCreateOrder,
    openBacktest,
    openSocial,
    openInsight,
    closeAll
  };
}

// Create hooks/useIntelligenceState.ts
interface IntelligenceState {
  jobId: string | null;
  asofDate: string | null;
  symbols: string[];
}

export function useIntelligenceState() {
  const [state, setState] = useState<IntelligenceState>(() => ({
    jobId: localStorage.getItem('intelligence.jobId'),
    asofDate: localStorage.getItem('intelligence.asofDate'),
    symbols: JSON.parse(localStorage.getItem('intelligence.symbols') || '[]')
  }));
  
  useEffect(() => {
    if (state.jobId) {
      localStorage.setItem('intelligence.jobId', state.jobId);
    } else {
      localStorage.removeItem('intelligence.jobId');
    }
    
    if (state.asofDate) {
      localStorage.setItem('intelligence.asofDate', state.asofDate);
    } else {
      localStorage.removeItem('intelligence.asofDate');
    }
    
    localStorage.setItem('intelligence.symbols', JSON.stringify(state.symbols));
  }, [state]);
  
  const reset = useCallback(() => {
    setState({ jobId: null, asofDate: null, symbols: [] });
  }, []);
  
  return { intelligence: state, setIntelligence: setState, resetIntelligence: reset };
}

// Now Screener.tsx becomes clean
export default function Screener() {
  const form = useScreenerForm();
  const modals = useScreenerModals();
  const { intelligence, setIntelligence, resetIntelligence } = useIntelligenceState();
  
  // Much cleaner!
  return (
    <div>
      <ScreenerForm 
        form={form.form}
        onUpdate={form.updateForm}
        onRun={handleRun}
      />
      {/* ... */}
    </div>
  );
}
```

**Testing Benefits:**
```typescript
// Now we can test hooks in isolation!
describe('useScreenerForm', () => {
  it('should persist form state to localStorage', () => {
    const { result } = renderHook(() => useScreenerForm());
    
    act(() => {
      result.current.updateForm({ topN: 50 });
    });
    
    expect(localStorage.getItem('screener.form')).toContain('"topN":50');
  });
  
  it('should restore form state from localStorage', () => {
    localStorage.setItem('screener.form', JSON.stringify({ topN: 100 }));
    
    const { result } = renderHook(() => useScreenerForm());
    
    expect(result.current.form.topN).toBe(100);
  });
});
```

**Estimated Effort:** 8-12 hours

---

### 2. Overly Large Page Components
**Files:** 
- `pages/Screener.tsx` - 685 lines
- `pages/Dashboard.tsx` - 503 lines
- `pages/Backtest.tsx` - 400+ lines

**Severity:** HIGH  
**Impact:** Hard to maintain, test, and understand

**Screener.tsx Responsibilities (9!):**
1. Form state management (universe, topN, prices, currency)
2. Screener API orchestration
3. Intelligence API orchestration
4. Social warmup polling
5. Modal state management (5 modals)
6. localStorage persistence (7 keys)
7. Result display
8. Table rendering
9. Intelligence UI

**Solution - Component Decomposition:**

```typescript
// Create components/pages/screener/ScreenerForm.tsx (~100 lines)
interface ScreenerFormProps {
  form: ScreenerFormState;
  onUpdate: (updates: Partial<ScreenerFormState>) => void;
  onRun: () => void;
  isRunning: boolean;
}

export function ScreenerForm({ form, onUpdate, onRun, isRunning }: ScreenerFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen Universe</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Universe</Label>
            <Select 
              value={form.universe}
              onValueChange={(value) => onUpdate({ universe: value })}
            >
              {/* Universe options */}
            </Select>
          </div>
          
          <div>
            <Label>Top N</Label>
            <Input
              type="number"
              value={form.topN}
              onChange={(e) => onUpdate({ topN: parseInt(e.target.value) })}
            />
          </div>
          
          {/* Price filters, currency filter */}
        </div>
        
        <Button onClick={onRun} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run Screener'}
        </Button>
      </CardContent>
    </Card>
  );
}

// Create components/pages/screener/ScreenerResults.tsx (~150 lines)
interface ScreenerResultsProps {
  result: ScreenerResult;
  onAction: (action: ScreenerAction) => void;
}

export function ScreenerResults({ result, onAction }: ScreenerResultsProps) {
  const summary = useScreenerSummary(result);
  
  return (
    <div className="space-y-4">
      <ScreenerSummaryCard summary={summary} />
      <ScreenerCandidatesTable 
        candidates={result.candidates}
        onAction={onAction}
      />
    </div>
  );
}

// Create components/pages/screener/IntelligencePanel.tsx (~120 lines)
interface IntelligencePanelProps {
  symbols: string[];
  jobId: string | null;
  asofDate: string | null;
  onJobComplete: (jobId: string, date: string) => void;
}

export function IntelligencePanel({ 
  symbols, 
  jobId, 
  asofDate, 
  onJobComplete 
}: IntelligencePanelProps) {
  const intelligence = useIntelligence(symbols, jobId);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Intelligence</CardTitle>
      </CardHeader>
      <CardContent>
        {intelligence.isLoading && <LoadingState />}
        {intelligence.data && (
          <IntelligenceOpportunities opportunities={intelligence.data} />
        )}
      </CardContent>
    </Card>
  );
}

// Create components/pages/screener/ScreenerModals.tsx (~100 lines)
interface ScreenerModalsProps {
  modals: ScreenerModals;
  onClose: () => void;
  onSuccess: () => void;
}

export function ScreenerModals({ modals, onClose, onSuccess }: ScreenerModalsProps) {
  return (
    <>
      {modals.createOrder && (
        <CandidateOrderModal
          candidate={modals.createOrder}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
      
      {modals.backtest && (
        <QuickBacktestModal
          candidate={modals.backtest}
          onClose={onClose}
        />
      )}
      
      {modals.social && (
        <SocialAnalysisModal
          ticker={modals.social}
          onClose={onClose}
        />
      )}
      
      {modals.insight && (
        <TradeInsightModal
          candidate={modals.insight.candidate}
          defaultTab={modals.insight.defaultTab}
          onClose={onClose}
        />
      )}
    </>
  );
}

// Now Screener.tsx is clean and readable! (~150 lines)
export default function Screener() {
  const form = useScreenerForm();
  const modals = useScreenerModals();
  const { intelligence, setIntelligence, resetIntelligence } = useIntelligenceState();
  
  const queryClient = useQueryClient();
  
  const screenerMutation = useRunScreenerMutation({
    onSuccess: (data) => {
      resetIntelligence();
      // Handle success
    }
  });
  
  const handleRun = () => {
    screenerMutation.mutate({
      universe: form.form.universe,
      top_n: form.form.topN,
      min_price: form.form.minPrice,
      max_price: form.form.maxPrice,
      currency_filter: form.form.currencyFilter
    });
  };
  
  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
    modals.closeAll();
  };
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <ScreenerForm
          form={form.form}
          onUpdate={form.updateForm}
          onRun={handleRun}
          isRunning={screenerMutation.isPending}
        />
        
        {screenerMutation.data && (
          <>
            <ScreenerResults
              result={screenerMutation.data}
              onAction={(action) => {
                switch (action.type) {
                  case 'createOrder':
                    modals.openCreateOrder(action.candidate);
                    break;
                  case 'quickBacktest':
                    modals.openBacktest(action.candidate);
                    break;
                  case 'showSocial':
                    modals.openSocial(action.ticker);
                    break;
                  case 'showInsight':
                    modals.openInsight(action.candidate, action.tab);
                    break;
                }
              }}
            />
            
            {screenerMutation.data.candidates.length > 0 && (
              <IntelligencePanel
                symbols={screenerMutation.data.candidates.map(c => c.ticker)}
                jobId={intelligence.jobId}
                asofDate={intelligence.asofDate}
                onJobComplete={(jobId, date) => {
                  setIntelligence({ jobId, asofDate: date, symbols: [...] });
                }}
              />
            )}
          </>
        )}
      </div>
      
      <ScreenerModals
        modals={modals.modals}
        onClose={modals.closeAll}
        onSuccess={handleModalSuccess}
      />
    </MainLayout>
  );
}
```

**File Structure:**
```
web-ui/src/
  pages/
    Screener.tsx              (~150 lines) ← Entry point
  components/
    pages/
      screener/
        ScreenerForm.tsx      (~100 lines)
        ScreenerResults.tsx   (~150 lines)
        IntelligencePanel.tsx (~120 lines)
        ScreenerModals.tsx    (~100 lines)
```

**Testing Benefits:**
```typescript
// Each component can be tested in isolation
describe('ScreenerForm', () => {
  it('should call onRun when button clicked', async () => {
    const onRun = vi.fn();
    const { user } = renderWithProviders(
      <ScreenerForm form={mockForm} onUpdate={vi.fn()} onRun={onRun} isRunning={false} />
    );
    
    await user.click(screen.getByText('Run Screener'));
    expect(onRun).toHaveBeenCalled();
  });
});

describe('ScreenerResults', () => {
  it('should display candidates table', () => {
    render(<ScreenerResults result={mockResult} onAction={vi.fn()} />);
    expect(screen.getByText(mockResult.candidates[0].ticker)).toBeInTheDocument();
  });
});
```

**Estimated Effort:** 12-16 hours

---

## 🟠 HIGH PRIORITY ISSUES

### 3. Duplicate localStorage Patterns
**Severity:** MEDIUM  
**Impact:** ~200 lines of duplication across 19 locations

**Current Pattern (Repeated 19 times):**
```typescript
const [topN, setTopN] = useState<number>(() => {
  const saved = localStorage.getItem('screener.topN');
  if (!saved) return 20;
  const parsed = parseInt(saved, 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), TOP_N_MAX);
});

useEffect(() => {
  localStorage.setItem('screener.topN', topN.toString());
}, [topN]);
```

**Problems:**
1. Boilerplate repeated everywhere
2. Inconsistent error handling
3. No validation
4. Hard to test
5. Manual serialization/deserialization

**Solution - Type-Safe localStorage Hook:**

```typescript
// Create hooks/useLocalStorage.ts
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: {
    schema?: z.ZodSchema<T>;
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
): [T, (value: T | ((prev: T) => T)) => void] {
  const {
    schema,
    serialize = JSON.stringify,
    deserialize = JSON.parse
  } = options || {};
  
  // Initialize from localStorage
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaultValue;
      
      const parsed = deserialize(raw);
      
      // Validate with Zod schema if provided
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          console.warn(`Invalid localStorage value for ${key}:`, result.error);
          return defaultValue;
        }
        return result.data;
      }
      
      return parsed;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  });
  
  // Persist to localStorage
  const setAndPersist = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const valueToStore = newValue instanceof Function ? newValue(prev) : newValue;
      
      try {
        const serialized = serialize(valueToStore);
        localStorage.setItem(key, serialized);
      } catch (error) {
        console.error(`Failed to save ${key} to localStorage:`, error);
      }
      
      return valueToStore;
    });
  }, [key, serialize]);
  
  return [value, setAndPersist];
}

// Usage examples
const [topN, setTopN] = useLocalStorage(
  'screener.topN',
  20,
  { schema: z.number().min(1).max(200) }
);

const [form, setForm] = useLocalStorage(
  'screener.form',
  { universe: 'mega_all', topN: 20 },
  { schema: screenerFormSchema }
);

const [expandedRows, setExpandedRows] = useLocalStorage(
  'screener.expandedRows',
  new Set<string>(),
  {
    serialize: (set) => JSON.stringify(Array.from(set)),
    deserialize: (str) => new Set(JSON.parse(str))
  }
);
```

**Testing:**
```typescript
describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should return default value when key not in storage', () => {
    const { result } = renderHook(() => useLocalStorage('test', 42));
    expect(result.current[0]).toBe(42);
  });
  
  it('should persist value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test', 0));
    
    act(() => {
      result.current[1](100);
    });
    
    expect(localStorage.getItem('test')).toBe('100');
    expect(result.current[0]).toBe(100);
  });
  
  it('should validate with Zod schema', () => {
    localStorage.setItem('test', '999'); // Invalid
    
    const { result } = renderHook(() => 
      useLocalStorage('test', 50, { 
        schema: z.number().max(100) 
      })
    );
    
    expect(result.current[0]).toBe(50); // Falls back to default
  });
});
```

**Migration:**
```typescript
// Before
const [topN, setTopN] = useState<number>(() => {
  const saved = localStorage.getItem('screener.topN');
  if (!saved) return 20;
  const parsed = parseInt(saved, 10);
  if (Number.isNaN(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), TOP_N_MAX);
});

useEffect(() => {
  localStorage.setItem('screener.topN', topN.toString());
}, [topN]);

// After
const [topN, setTopN] = useLocalStorage(
  'screener.topN',
  20,
  { schema: z.number().min(1).max(200) }
);
```

**Files to Update:** 19 locations across all pages

**Estimated Effort:** 6 hours

---

### 4. Duplicate Modal State Management
**Severity:** MEDIUM  
**Impact:** ~160 lines duplicated across 4 pages

**Current Pattern (Repeated in each page):**
```typescript
const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
const [selectedCandidate, setSelectedCandidate] = useState<ScreenerCandidate | null>(null);

const handleOpenCreateOrder = (candidate: ScreenerCandidate) => {
  setSelectedCandidate(candidate);
  setShowCreateOrderModal(true);
};

const handleCloseCreateOrder = () => {
  setShowCreateOrderModal(false);
  setTimeout(() => setSelectedCandidate(null), 200);
};

{showCreateOrderModal && selectedCandidate && (
  <CandidateOrderModal
    candidate={selectedCandidate}
    onClose={handleCloseCreateOrder}
  />
)}
```

**Solution - Reusable Modal Hook:**

```typescript
// Create hooks/useModal.ts
import { useCallback, useState } from 'react';

export function useModal<T = void>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  
  const open = useCallback((payload?: T) => {
    if (payload !== undefined) {
      setData(payload as T);
    }
    setIsOpen(true);
  }, []);
  
  const close = useCallback(() => {
    setIsOpen(false);
    // Delay data cleanup to allow exit animations
    setTimeout(() => setData(null), 200);
  }, []);
  
  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);
  
  return {
    isOpen,
    data,
    open,
    close,
    toggle
  };
}

// Usage in pages
export default function Screener() {
  const createOrderModal = useModal<ScreenerCandidate>();
  const backtestModal = useModal<ScreenerCandidate>();
  const socialModal = useModal<string>();
  
  return (
    <div>
      <Button onClick={() => createOrderModal.open(candidate)}>
        Create Order
      </Button>
      
      {createOrderModal.isOpen && createOrderModal.data && (
        <CandidateOrderModal
          candidate={createOrderModal.data}
          onClose={createOrderModal.close}
        />
      )}
      
      {backtestModal.isOpen && backtestModal.data && (
        <QuickBacktestModal
          candidate={backtestModal.data}
          onClose={backtestModal.close}
        />
      )}
      
      {socialModal.isOpen && socialModal.data && (
        <SocialAnalysisModal
          ticker={socialModal.data}
          onClose={socialModal.close}
        />
      )}
    </div>
  );
}
```

**Advanced Version with Context:**
```typescript
// For complex modal orchestration
interface ModalState {
  createOrder: ScreenerCandidate | null;
  backtest: ScreenerCandidate | null;
  social: string | null;
}

export function useModalOrchestrator() {
  const [modals, setModals] = useState<ModalState>({
    createOrder: null,
    backtest: null,
    social: null
  });
  
  const open = useCallback(<K extends keyof ModalState>(
    key: K,
    data: ModalState[K]
  ) => {
    setModals(prev => ({ ...prev, [key]: data }));
  }, []);
  
  const close = useCallback((key: keyof ModalState) => {
    setModals(prev => ({ ...prev, [key]: null }));
  }, []);
  
  const closeAll = useCallback(() => {
    setModals({
      createOrder: null,
      backtest: null,
      social: null
    });
  }, []);
  
  return { modals, open, close, closeAll };
}
```

**Testing:**
```typescript
describe('useModal', () => {
  it('should open modal with data', () => {
    const { result } = renderHook(() => useModal<string>());
    
    act(() => {
      result.current.open('test-data');
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe('test-data');
  });
  
  it('should close modal and cleanup data', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useModal<string>());
    
    act(() => {
      result.current.open('test');
    });
    
    act(() => {
      result.current.close();
    });
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe('test'); // Still there
    
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    expect(result.current.data).toBeNull(); // Cleaned up
    vi.useRealTimers();
  });
});
```

**Estimated Effort:** 4 hours

---

### 5-7. Additional High Priority Issues

*Full details in main report for:*
- Duplicate form submission logic (~210 lines)
- Missing performance optimizations (ScreenerCandidatesTable)
- Missing integration tests

---

## 🟡 MEDIUM PRIORITY ISSUES

### 8. Prop Drilling in Table Components
**File:** `components/domain/screener/ScreenerCandidatesTable.tsx`  
**Severity:** MEDIUM

**Current:** 6 callbacks passed through props

**Solution - Action Dispatch Pattern:**
```typescript
// Define action types
type ScreenerAction =
  | { type: 'createOrder'; candidate: ScreenerCandidate }
  | { type: 'showRecommendation'; candidate: ScreenerCandidate }
  | { type: 'analyzeSocial'; ticker: string }
  | { type: 'showThesis'; candidate: ScreenerCandidate }
  | { type: 'quickBacktest'; candidate: ScreenerCandidate };

// Single callback prop
interface ScreenerCandidatesTableProps {
  candidates: ScreenerCandidate[];
  onAction: (action: ScreenerAction) => void;
}

// Usage
<ScreenerCandidatesTable
  candidates={candidates}
  onAction={(action) => {
    switch (action.type) {
      case 'createOrder':
        modals.openCreateOrder(action.candidate);
        break;
      case 'showRecommendation':
        modals.openRecommendation(action.candidate);
        break;
      // ...
    }
  }}
/>
```

---

## 📝 IMPLEMENTATION CHECKLIST (Updated 2026-02-16)

### ⚠️ Prerequisites
- [ ] **CRITICAL:** `web-ui/src/hooks/` directory must be created first
- [ ] All tests passing before starting refactor
- [ ] Feature branch created: `refactor/frontend-hooks`

### Phase 1: Custom Hooks (Week 1 - 22h)
- [ ] Create `hooks/` directory structure
- [ ] Create `hooks/useLocalStorage.ts` with tests (8h) - **HIGHEST IMPACT**
- [ ] Create `hooks/useModal.ts` with tests (4h)
- [ ] Create `hooks/useFormSubmission.ts` with tests (6h)
- [ ] Create `hooks/useScreenerForm.ts` with tests (4h)

**Status:** ❌ NOT STARTED - hooks/ directory doesn't exist

### Phase 2: Screener.tsx Refactor (Weeks 2-3 - 36h)
- [ ] Apply useLocalStorage to Screener.tsx (8h)
- [ ] Apply useScreenerForm to centralize state (6h)
- [ ] Extract `ScreenerForm.tsx` component (6h)
- [ ] Extract `ScreenerResults.tsx` component (6h)
- [ ] Extract `IntelligencePanel.tsx` component (6h)
- [ ] Update main `Screener.tsx` to compose (4h)

**Goal:** Reduce from 904 → ~150-200 lines

### Phase 3: Apply to Other Pages (Week 4 - 16h)
- [ ] Refactor `Dashboard.tsx` with hooks (8h)
- [ ] Refactor `Positions.tsx` with hooks (4h)
- [ ] Add integration tests (4h)

---

## 🎯 SUCCESS METRICS

### Code Quality
- Screener.tsx: 904 → <200 lines (78% reduction)
- useState hooks: 17 → <5 (71% reduction)
- localStorage duplication: Eliminated (300+ lines saved)

### Maintainability
- All hooks reusable across pages
- Component complexity reduced
- Test coverage maintained at 80%+

---

**Estimated Total: 74 hours (~9 days, 1 developer)**  
**Status:** 0% complete - Must start with Phase 1
