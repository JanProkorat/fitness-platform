interface MultiFieldInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}

export function MultiFieldInput({
  values,
  onChange,
  placeholder,
}: MultiFieldInputProps) {
  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const addValue = () => {
    onChange([...values, '']);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {values.map((val, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            className="form-input"
            value={val}
            onChange={(e) => updateValue(i, e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeValue(i)}
            style={{
              width: 28, height: 28, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'none', cursor: 'pointer', color: 'var(--text3)',
              fontSize: 13, fontFamily: 'inherit', transition: 'color 0.1s, border-color 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addValue}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', border: '1px dashed var(--border-md)',
          borderRadius: 'var(--radius-md)', background: 'none',
          cursor: 'pointer', color: 'var(--text3)', fontSize: 12,
          fontFamily: 'inherit', transition: 'color 0.1s, border-color 0.1s',
          alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hv)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
      >
        + {placeholder}
      </button>
    </div>
  );
}
