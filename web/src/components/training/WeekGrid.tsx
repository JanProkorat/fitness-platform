import { cn } from '@/lib/cn';
import { SessionCard } from './SessionCard';

export interface SessionData {
  id: string;
  name: string;
  meta?: string;
}

export interface DayData {
  dayIndex: number;
  label: string;
  isToday?: boolean;
  isRest?: boolean;
  sessions: SessionData[];
}

export interface WeekGridProps {
  days: DayData[];
  onSessionClick?: (sessionId: string) => void;
  onAddSession?: (dayIndex: number) => void;
}

export function WeekGrid({ days, onSessionClick, onAddSession }: WeekGridProps) {
  return (
    <div className="grid grid-cols-7 gap-1.5 mb-3">
      {days.map((day) => (
        <div
          key={day.dayIndex}
          className="border border-border rounded-md overflow-hidden min-h-[180px] flex flex-col"
        >
          {/* Day header */}
          <div
            className={cn(
              'px-2 py-1.5 border-b border-border text-[11px] font-semibold uppercase tracking-[0.04em]',
              day.isToday
                ? 'text-blue bg-blue-bg'
                : 'text-text3 bg-bg2',
            )}
          >
            {day.label}
          </div>

          {/* Day body */}
          <div className="p-1.5 flex-1">
            {day.isRest ? (
              <div className="text-center text-text4 text-xs py-4">
                Odpočinek
              </div>
            ) : (
              <>
                {day.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    name={session.name}
                    meta={session.meta}
                    onClick={() => onSessionClick?.(session.id)}
                  />
                ))}
              </>
            )}

            {/* Add session button */}
            {onAddSession && !day.isRest && (
              <div
                className="text-xs text-text4 text-center p-1 cursor-pointer rounded-sm transition-colors hover:bg-bg-hover hover:text-text3"
                onClick={() => onAddSession(day.dayIndex)}
              >
                + Přidat
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
