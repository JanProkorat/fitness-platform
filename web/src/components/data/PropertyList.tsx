import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';

interface PropertyItem {
  label: string;
  icon?: string;
  value: React.ReactNode;
  editable?: boolean;
  onEdit?: (value: string) => void;
}

interface PropertyListProps {
  items: PropertyItem[];
  className?: string;
}

function EditableValue({
  value,
  onEdit,
}: {
  value: React.ReactNode;
  onEdit?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    onEdit?.(editValue);
  }, [editValue, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        setEditing(false);
        onEdit?.(editValue);
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [editValue, onEdit],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="inline-block px-1 py-[1px] rounded-sm text-[13px] text-text bg-bg-active outline-1 outline-border-md border-none font-inherit"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <span
      className="inline-block px-1 py-[1px] rounded-sm cursor-text transition-colors hover:bg-bg-hover"
      onClick={() => {
        setEditValue(typeof value === 'string' ? value : '');
        setEditing(true);
      }}
    >
      {value}
    </span>
  );
}

export function PropertyList({ items, className }: PropertyListProps) {
  return (
    <div className={cn('mb-4', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start py-1 rounded-md transition-colors cursor-default hover:bg-bg-hover"
        >
          <div className="w-[170px] shrink-0 text-[13px] text-text3 flex items-center gap-1.5 px-2 py-[2px]">
            {item.icon && <span>{item.icon}</span>}
            {item.label}
          </div>
          <div className="flex-1 text-[13px] text-text px-2 py-[2px]">
            {item.editable ? (
              <EditableValue value={item.value} onEdit={item.onEdit} />
            ) : (
              item.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
