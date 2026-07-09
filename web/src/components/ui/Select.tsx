import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239b9a97'/%3E%3C/svg%3E")`;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || (label ? generatedId : undefined);

    const select = (
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'w-full py-[7px] px-2.5 border border-border-md rounded-md text-[13px] text-text bg-bg font-[inherit] cursor-pointer transition-colors duration-150 appearance-none focus:outline-none focus:border-border-hv',
          error && 'border-red',
          className,
        )}
        style={{
          backgroundImage: chevronSvg,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
        {...props}
      >
        {children}
      </select>
    );

    if (!label && !hint && !error) return select;

    return (
      <div className="mb-3.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-text2 mb-1.5">
            {label}
          </label>
        )}
        {select}
        {error && <p className="text-[11px] text-red mt-1">{error}</p>}
        {!error && hint && <p className="text-[11px] text-text3 mt-1">{hint}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
