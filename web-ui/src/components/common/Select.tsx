import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { useFieldControl } from './Field';
import { CONTROL_CLASS } from './Input';

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, id, children, ...props }, ref) {
    const field = useFieldControl();
    return (
      <select ref={ref} id={id ?? field?.id} className={cn(CONTROL_CLASS, className)} {...props}>
        {children}
      </select>
    );
  },
);

export default Select;
