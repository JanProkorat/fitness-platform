import { cn } from '@/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-9 h-5 rounded-[10px] border cursor-pointer relative transition-colors duration-200',
        checked ? 'bg-green border-[var(--green-br)]' : 'bg-bg3 border-border-md',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-[left] duration-200',
          checked ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </button>
  );

  if (!label) return toggle;

  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-text">{label}</span>
      {toggle}
    </div>
  );
}
