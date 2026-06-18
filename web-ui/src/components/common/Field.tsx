import { createContext, useContext, useId, type ReactNode } from 'react';

interface FieldContextValue {
  id: string;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read the owning Field's generated id, so Input/Select can auto-wire `id` for label association. */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}

interface FieldProps {
  label: string;
  /** Helper text shown below the control. Hidden when `error` is set. */
  hint?: string;
  /** Error text shown below the control, replacing the hint. */
  error?: string;
  /** Override the generated control id (defaults to a `useId` value). */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export default function Field({ label, hint, error, htmlFor, className, children }: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;

  return (
    <FieldContext.Provider value={{ id }}>
      <div className={className}>
        <label htmlFor={id} className="block text-sm font-medium text-muted mb-1">
          {label}
        </label>
        {children}
        {error ? (
          <p className="mt-1 text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-xs text-muted">{hint}</p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
