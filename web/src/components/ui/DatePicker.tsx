import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { cs } from 'date-fns/locale';

interface DatePickerProps {
  value?: string | null; // ISO date string (YYYY-MM-DD)
  onChange: (date: string | null) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Vyberte datum' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const displayValue = selected && isValid(selected) ? format(selected, 'd. MMMM yyyy', { locale: cs }) : '';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="auth-input"
        style={{
          width: '100%', fontSize: 13, padding: '7px 10px', cursor: 'pointer',
          textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ color: displayValue ? 'var(--text)' : 'var(--text3)' }}>
          {displayValue || placeholder}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>📅</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border-md)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: 16,
          }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (day) {
                onChange(format(day, 'yyyy-MM-dd'));
              } else {
                onChange(null);
              }
              setOpen(false);
            }}
            locale={cs}
            weekStartsOn={1}
            styles={{
              months: { display: 'flex', flexDirection: 'column' },
              month: { },
              caption: { display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', padding: '4px 0 8px' },
              caption_label: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
              nav: { display: 'flex', gap: 4, position: 'absolute', right: 0 },
              nav_button: { width: 28, height: 28, border: 'none', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 },
              table: { width: '100%', borderCollapse: 'collapse' },
              head_cell: { fontSize: 11, fontWeight: 500, color: 'var(--text3)', textAlign: 'center', padding: '4px 0', textTransform: 'capitalize' },
              cell: { textAlign: 'center', padding: 1 },
              day: { width: 32, height: 32, border: 'none', borderRadius: 'var(--radius)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text)', transition: 'background 0.1s' },
              day_selected: { background: 'var(--accent)', color: '#1a1200', fontWeight: 600 },
              day_today: { fontWeight: 700, color: 'var(--accent)' },
              day_outside: { color: 'var(--text4)' },
            }}
            modifiersStyles={{
              selected: { background: 'var(--accent)', color: '#1a1200', fontWeight: 600 },
              today: { fontWeight: 700, color: 'var(--accent)' },
            }}
          />
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              style={{
                width: '100%', marginTop: 4, padding: '5px 0', border: 'none',
                background: 'transparent', cursor: 'pointer', fontSize: 11,
                color: 'var(--text3)', fontFamily: 'inherit', transition: 'color 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
            >
              Vymazat datum
            </button>
          )}
        </div>
      )}
    </div>
  );
}
