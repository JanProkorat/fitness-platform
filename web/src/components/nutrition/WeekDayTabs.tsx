import { useState, useRef } from 'react';
import { cn } from '@/lib/cn';

export interface WeekTabData {
  index: number;
  label: string;
  badge?: string;
  /**
   * Week is published and currently active (start <= now < end).
   * Renders an amber hourglass icon. Has no effect when `isFinished` is true.
   */
  isPublished?: boolean;
  /**
   * Week is published AND its end date has passed — read-only historical record.
   * Renders the green check icon. Takes precedence over `isPublished`.
   */
  isFinished?: boolean;
}

export interface DayTabData {
  index: number;
  label: string;
  badge?: string;
}

export interface WeekDayTabsProps {
  weeks: WeekTabData[];
  days: DayTabData[];
  selectedWeek: number;
  selectedDay: number;
  onWeekChange: (index: number) => void;
  onDayChange: (index: number) => void;
  onAddWeek?: () => void;
  onRemoveWeek?: (index: number) => void;
  onReorderWeeks?: (weekNumbers: number[]) => void;
}

export function WeekDayTabs({
  weeks,
  days,
  selectedWeek,
  selectedDay,
  onWeekChange,
  onDayChange,
  onAddWeek,
  onRemoveWeek,
  onReorderWeeks,
}: WeekDayTabsProps) {
  const [dragOverWeek, setDragOverWeek] = useState<number | null>(null);
  const weekHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [weekDragOver, setWeekDragOver] = useState<number | null>(null);

  return (
    <div>
      {/* Week tabs */}
      <div className="flex items-center border-b border-border" style={{ paddingLeft: 10 }}>
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto" style={{ gap: 8, scrollbarWidth: 'none' }}>
          {weeks.map((week) => {
            const active = week.index === selectedWeek;
            return (
              <div
                key={week.index}
                className="group relative"
                draggable={!!onReorderWeeks}
                onDragStart={(e) => {
                  if (!onReorderWeeks) return;
                  e.dataTransfer.setData('application/week-json', JSON.stringify({ type: 'week', weekNumber: week.index }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                style={{
                  flex: 1, display: 'flex', justifyContent: 'center',
                  background: dragOverWeek === week.index || weekDragOver === week.index ? 'var(--accent-bg)' : undefined,
                  borderLeft: weekDragOver === week.index ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'background 0.15s',
                  cursor: onReorderWeeks ? 'grab' : undefined,
                }}
                onDragOver={(e) => {
                  const hasWeek = e.dataTransfer.types.includes('application/week-json');
                  const hasMeal = e.dataTransfer.types.includes('application/meal-json');
                  const hasItem = e.dataTransfer.types.includes('application/json');
                  const hasSession = e.dataTransfer.types.includes('application/session-json');
                  const hasExercise = e.dataTransfer.types.includes('application/exercise-json');
                  if (!hasWeek && !hasMeal && !hasItem && !hasSession && !hasExercise) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (hasWeek) {
                    setWeekDragOver(week.index);
                  } else if (dragOverWeek !== week.index) {
                    setDragOverWeek(week.index);
                    if (weekHoverTimer.current) clearTimeout(weekHoverTimer.current);
                    weekHoverTimer.current = setTimeout(() => {
                      onWeekChange(week.index);
                    }, 500);
                  }
                }}
                onDragLeave={() => {
                  setWeekDragOver(null);
                  if (dragOverWeek === week.index) {
                    setDragOverWeek(null);
                    if (weekHoverTimer.current) { clearTimeout(weekHoverTimer.current); weekHoverTimer.current = null; }
                  }
                }}
                onDrop={(e) => {
                  setDragOverWeek(null);
                  setWeekDragOver(null);
                  if (weekHoverTimer.current) { clearTimeout(weekHoverTimer.current); weekHoverTimer.current = null; }
                  if (e.dataTransfer.types.includes('application/week-json') && onReorderWeeks) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      const data = JSON.parse(e.dataTransfer.getData('application/week-json'));
                      if (data.type === 'week' && data.weekNumber !== week.index) {
                        const currentOrder = weeks.map(w => w.index);
                        const oldIdx = currentOrder.indexOf(data.weekNumber);
                        const newIdx = currentOrder.indexOf(week.index);
                        if (oldIdx !== -1 && newIdx !== -1) {
                          const reordered = [...currentOrder];
                          reordered.splice(oldIdx, 1);
                          reordered.splice(newIdx, 0, data.weekNumber);
                          onReorderWeeks(reordered);
                        }
                      }
                    } catch { /* ignore */ }
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => onWeekChange(week.index)}
                  style={{ justifyContent: 'center', width: '100%' }}
                  className={cn(
                    'py-[7px] text-xs text-text3 cursor-pointer border-b-2 border-transparent -mb-px whitespace-nowrap transition-colors flex items-center gap-[5px] hover:text-text',
                    active && 'text-text border-b-text font-medium',
                  )}
                >
                  <span className="text-[11px]">📅</span>
                  {week.label}
                  {week.isFinished ? (
                    <span
                      className="text-[10px] rounded-full px-[5px] bg-green-bg text-green"
                      title="Týden byl ukončen"
                    >
                      ✓
                    </span>
                  ) : week.isPublished ? (
                    <span
                      className="text-[10px] rounded-full px-[5px] bg-orange-bg text-orange"
                      title="Týden je publikován a stále upravitelný"
                    >
                      ⏳
                    </span>
                  ) : null}
                </button>
                {onRemoveWeek && weeks.length > 1 && !week.isPublished && !week.isFinished && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemoveWeek(week.index); }}
                    className="opacity-0 group-hover:opacity-100"
                    style={{
                      position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                      width: 16, height: 16, padding: 0, border: 'none', borderRadius: 'var(--radius)',
                      background: 'transparent', cursor: 'pointer', fontSize: 10, color: 'var(--text4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'color 0.1s, background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text4)'; e.currentTarget.style.background = 'transparent'; }}
                    title="Odebrat týden"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {onAddWeek && (
          <button
            type="button"
            onClick={onAddWeek}
            style={{
              padding: '5px 12px', marginLeft: 8, marginRight: 12, border: '1px solid var(--border-md)',
              background: 'var(--bg)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              color: 'var(--text2)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
              transition: 'color 0.1s, background 0.1s, border-color 0.1s',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-hv)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border-md)'; }}
            title="Přidat týden"
          >
            + Týden
          </button>
        )}
      </div>

      {/* Day tabs */}
      <div className="flex items-center border-b border-border px-20 overflow-x-auto">
        {days.map((day) => {
          const active = day.index === selectedDay;
          return (
            <button
              key={day.index}
              type="button"
              onClick={() => onDayChange(day.index)}
              className={cn(
                'px-2.5 py-[7px] text-xs text-text3 cursor-pointer border-b-2 border-transparent -mb-px whitespace-nowrap text-center hover:text-text',
                active && 'text-text border-b-text font-medium',
              )}
            >
              {day.label}
              {day.badge && (
                <span
                  className={cn(
                    'text-[10px] block mt-[1px]',
                    active ? 'text-text3' : 'text-text4',
                  )}
                >
                  {day.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
