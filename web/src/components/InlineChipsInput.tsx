import { useRef, useState } from 'react';

export type ChipColorScheme = 'gold' | 'green' | 'gray';

interface InlineChipsInputProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  colorScheme: ChipColorScheme;
}

const schemeStyles: Record<ChipColorScheme, { bg: string; color: string }> = {
  gold: {
    bg: 'rgba(201,168,76,.1)',
    color: 'var(--accent)',
  },
  green: {
    bg: 'rgba(52,199,89,.12)',
    color: 'var(--green)',
  },
  gray: {
    bg: 'var(--bg3)',
    color: 'var(--text2)',
  },
};

export function InlineChipsInput({
  values,
  onChange,
  placeholder,
  colorScheme,
}: InlineChipsInputProps) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { bg, color } = schemeStyles[colorScheme];

  const addValue = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    // no-op if already present
    if (values.includes(trimmed)) {
      setInputVal('');
      return;
    }
    onChange([...values, trimmed]);
    setInputVal('');
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {values.map((val, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 99,
            background: bg,
            color,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {val}
          <button
            type="button"
            onClick={() => removeValue(i)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.6,
              color: 'inherit',
              fontSize: 12,
              padding: 0,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
            aria-label={`Remove ${val}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="form-input"
        value={inputVal}
        placeholder={placeholder}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addValue(inputVal);
          }
        }}
        onBlur={() => {
          if (inputVal.trim()) addValue(inputVal);
        }}
        style={{
          flex: 1,
          minWidth: 120,
          padding: '4px 10px',
          fontSize: 12,
          margin: 0,
        }}
      />
    </div>
  );
}
