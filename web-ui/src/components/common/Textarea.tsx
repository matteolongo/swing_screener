import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import { useFieldControl } from './Field';
import { CONTROL_CLASS } from './Input';

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, id, ...props }, ref) {
    const field = useFieldControl();
    return <textarea ref={ref} id={id ?? field?.id} className={cn(CONTROL_CLASS, className)} {...props} />;
  },
);

export default Textarea;
