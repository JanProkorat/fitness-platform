import { useState, useEffect } from 'react';

interface DayNoteInputProps {
  note?: string | null;
  onChange: (note: string) => void;
  addLabel: string;
  placeholder: string;
}

export function DayNoteInput({ note, onChange, addLabel, placeholder }: DayNoteInputProps) {
  const [value, setValue] = useState(note ?? '');
  const [open, setOpen] = useState(!!note);

  // Sync when day changes
  useEffect(() => {
    setValue(note ?? '');
    if (note) setOpen(true);
    else setOpen(false);
  }, [note]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 8px',
          fontSize: 11, color: 'var(--text4)', fontFamily: 'inherit', transition: 'color 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; }}
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onChange(value)}
        placeholder={placeholder}
        style={{
          width: '100%', border: '1px dashed var(--border-md)', outline: 'none',
          background: 'transparent', fontSize: 12, color: 'var(--text2)',
          fontFamily: 'inherit', fontStyle: 'italic', padding: '5px 8px',
          borderRadius: 'var(--radius-md)', transition: 'border-color 0.15s',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent-br)'; }}
        onBlurCapture={(e) => { e.target.style.borderColor = 'var(--border-md)'; }}
      />
    </div>
  );
}
