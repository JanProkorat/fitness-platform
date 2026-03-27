import { cn } from '@/lib/cn';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearch?: (value: string) => void;
}

export function SearchInput({ onSearch, className, onChange, ...props }: SearchInputProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border border-border-md rounded-md py-1.5 px-2.5 bg-bg transition-colors duration-150 focus-within:border-border-hv',
        className,
      )}
    >
      <svg
        className="shrink-0 text-text3"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        className="border-none outline-none bg-transparent text-[13px] text-text flex-1 font-[inherit] placeholder:text-text3"
        onChange={(e) => {
          onChange?.(e);
          onSearch?.(e.target.value);
        }}
        {...props}
      />
    </div>
  );
}
