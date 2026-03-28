
export interface PageHeaderProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2.5 border-b border-border">
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {icon && (
          <span className="text-[32px] leading-none shrink-0">{icon}</span>
        )}
        <div>
          <h1 className="mb-1 text-[28px] font-bold leading-tight tracking-tight text-text">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-text3">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="ml-4 flex shrink-0 items-end gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
