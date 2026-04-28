import { cn } from '@/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'brand' | 'danger' | 'ghost';
  size?: 'default' | 'sm';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'border-border-md bg-bg text-text hover:bg-bg-hover',
  primary: 'bg-text text-bg border-transparent hover:opacity-85',
  brand: 'bg-accent text-bg border-transparent hover:opacity-85 disabled:bg-accent-bg disabled:text-accent disabled:border-[var(--accent-br)] disabled:hover:opacity-100',
  danger: 'bg-red-bg text-red border-[var(--red-br)] hover:bg-[rgba(192,57,43,0.14)]',
  ghost: 'border-transparent hover:bg-bg-hover hover:border-border',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'px-2.5 py-[5px]',
  sm: 'px-2 py-[3px] text-xs',
};

export function Button({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-[5px] rounded-md text-[13px] font-medium cursor-pointer whitespace-nowrap border transition-colors duration-100',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
