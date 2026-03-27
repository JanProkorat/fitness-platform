import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const input = (
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full py-[7px] px-2.5 border border-border-md rounded-md text-[13px] text-text bg-bg font-[inherit] transition-colors duration-150 placeholder:text-text3 focus:outline-none focus:border-border-hv',
          error && 'border-red',
          className,
        )}
        {...props}
      />
    );

    if (!label && !hint && !error) return input;

    return (
      <div className="mb-3.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-text2 mb-1.5">
            {label}
          </label>
        )}
        {input}
        {error && <p className="text-[11px] text-red mt-1">{error}</p>}
        {!error && hint && <p className="text-[11px] text-text3 mt-1">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
