import { useState, useEffect } from 'react';

const DARK_MODE_KEY = 'gf-dark-mode';

export function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(DARK_MODE_KEY, String(dark));
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 16, color: 'var(--text3)', padding: '4px 6px',
        borderRadius: 'var(--radius)', transition: 'color 0.1s',
      }}
      title={dark ? 'Světlý režim' : 'Tmavý režim'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
