import { cn } from '@/lib/cn';

export interface ToolbarView {
  id: string;
  label: string;
  icon?: string;
}

export interface ToolbarProps {
  views?: ToolbarView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  children?: React.ReactNode;
}

export function Toolbar({
  views,
  activeView,
  onViewChange,
  children,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-20 py-1.5">
      {/* View switcher */}
      {views?.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onViewChange?.(view.id)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 text-[13px] transition-colors duration-100',
            activeView === view.id
              ? 'bg-bg-active font-medium text-text'
              : 'text-text2 hover:bg-bg-hover hover:text-text',
          )}
        >
          {view.icon && <span className="text-sm">{view.icon}</span>}
          {view.label}
        </button>
      ))}

      {/* Separator between views and actions */}
      {views && views.length > 0 && children && (
        <div className="mx-1 h-[18px] w-px bg-border-md" />
      )}

      {/* Actions slot */}
      {children && (
        <div className="ml-auto flex items-center gap-1">{children}</div>
      )}
      {!children && <div className="flex-1" />}
    </div>
  );
}
