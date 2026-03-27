import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-20 pt-7 pb-2.5">
      <div className="min-w-0 flex-1">
        {icon && (
          <div className="mb-1.5 text-[32px] leading-none">{icon}</div>
        )}
        <h1 className="mb-1 text-[28px] font-bold leading-tight tracking-tight text-text">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-text3">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="ml-4 flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
