import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface MondayDatePickerProps {
  value?: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Monday = 0, Sunday = 6 in our grid
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES_CS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function MondayDatePicker({ value, onChange, placeholder, className, style }: MondayDatePickerProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, openUp: false });

  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());

  const monthNames = i18n.language.startsWith('de') ? MONTH_NAMES_DE : i18n.language.startsWith('cs') ? MONTH_NAMES_CS : MONTH_NAMES_EN;

  const days = getMonthDays(viewYear, viewMonth);
  const today = formatDate(new Date());

  const handleOpen = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 320 && rect.top > spaceBelow;
      const calWidth = 280;
      let left = rect.left;
      if (left + calWidth > window.innerWidth - 8) {
        left = window.innerWidth - calWidth - 8;
      }
      setPos({ top: openUp ? rect.top : rect.bottom, left, width: calWidth, openUp });
    }
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
    setIsOpen(true);
  };

  const handleSelect = (d: Date) => {
    onChange(formatDate(d));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const displayValue = parsed
    ? `${parsed.getDate()}. ${parsed.getMonth() + 1}. ${parsed.getFullYear()}`
    : '';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        readOnly
        value={displayValue}
        placeholder={placeholder ?? t('training.startDateHint')}
        onClick={handleOpen}
        className={className}
        style={{ ...style, cursor: 'pointer' }}
      />

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            left: pos.left, width: pos.width, zIndex: 1000,
            ...(pos.openUp ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            border: '1px solid var(--border-md)', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 12,
          }}
        >
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button
              type="button" onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 14, color: 'var(--text3)', borderRadius: 'var(--radius)', transition: 'color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button" onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 14, color: 'var(--text3)', borderRadius: 'var(--radius)', transition: 'color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; }}
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DAY_KEYS.map((key) => (
              <div key={key} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text3)', padding: '2px 0', textTransform: 'uppercase' }}>
                {t(`nutrition.${key}`).slice(0, 2)}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {days.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const isMonday = d.getDay() === 1;
              const dateStr = formatDate(d);
              const isSelected = value === dateStr;
              const isToday = dateStr === today;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!isMonday}
                  onClick={() => handleSelect(d)}
                  style={{
                    width: '100%', aspectRatio: '1', border: 'none', borderRadius: 'var(--radius)',
                    fontSize: 12, fontFamily: 'inherit', cursor: isMonday ? 'pointer' : 'default',
                    fontWeight: isSelected ? 600 : 400,
                    color: !isMonday ? 'var(--text4)' : isSelected ? 'var(--bg)' : isToday ? 'var(--accent)' : 'var(--text)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    transition: 'background 0.1s, color 0.1s',
                    opacity: isMonday ? 1 : 0.4,
                  }}
                  onMouseEnter={(e) => { if (isMonday && !isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { if (isMonday && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                width: '100%', marginTop: 8, padding: '5px 0', border: '1px solid var(--border-md)',
                borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer',
                fontSize: 11, color: 'var(--text3)', fontFamily: 'inherit', transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)'; }}
            >
              {t('common.clear')}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
