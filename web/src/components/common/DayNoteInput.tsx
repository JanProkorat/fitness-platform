import { useState } from 'react';

interface DayNoteInputProps {
  note?: string | null;
  onChange: (note: string) => void;
  addLabel: string;
  placeholder: string;
  /** When true, the "Add note" affordance is hidden (no value to display)
   *  and the editing input — when a note already exists — becomes read-only
   *  with a not-allowed cursor. Use for past-day / locked views. */
  disabled?: boolean;
}

export function DayNoteInput({ note, onChange, addLabel, placeholder, disabled }: DayNoteInputProps) {
  const [value, setValue] = useState(note ?? '');
  const [open, setOpen] = useState(!!note);
  const [trackedNote, setTrackedNote] = useState(note);

  if (note !== trackedNote) {
    setTrackedNote(note);
    setValue(note ?? '');
    setOpen(!!note);
  }

  if (!open) {
    // Hide the "Add note" button entirely on disabled days — there's no
    // existing text to display and the user shouldn't be able to attach a
    // new note to a past / locked day.
    if (disabled) return null;
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
        disabled={disabled}
        style={{
          width: '100%', border: '1px dashed var(--border-md)', outline: 'none',
          background: 'transparent', fontSize: 12, color: 'var(--text2)',
          fontFamily: 'inherit', fontStyle: 'italic', padding: '5px 8px',
          borderRadius: 'var(--radius-md)', transition: 'border-color 0.15s',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocus={(e) => { if (!disabled) e.target.style.borderColor = 'var(--accent-br)'; }}
        onBlurCapture={(e) => { e.target.style.borderColor = 'var(--border-md)'; }}
      />
    </div>
  );
}
