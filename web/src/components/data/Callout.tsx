import { cn } from '@/lib/cn';

interface CalloutProps {
  variant?: 'warning' | 'info' | 'error' | 'success';
  icon?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<string, string> = {
  warning: 'bg-orange-bg border-l-[3px] border-l-orange',
  info: 'bg-blue-bg border-l-[3px] border-l-blue',
  error: 'bg-red-bg border-l-[3px] border-l-red',
  success: 'bg-green-bg border-l-[3px] border-l-green',
};

export function Callout({
  variant = 'warning',
  icon,
  title,
  children,
  className,
}: CalloutProps) {
  return (
    <div
      className={cn(
        'flex gap-2.5 p-2.5 px-3.5 rounded-md mb-2',
        variantStyles[variant],
        className,
      )}
    >
      {icon && (
        <span className="text-base shrink-0 mt-[1px]">{icon}</span>
      )}
      <div className="flex-1">
        {title && (
          <div className="text-[13px] font-semibold mb-[2px]">{title}</div>
        )}
        <div className="text-[13px] text-text2 leading-normal">{children}</div>
      </div>
    </div>
  );
}
