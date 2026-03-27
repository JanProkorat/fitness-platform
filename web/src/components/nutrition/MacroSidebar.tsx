import { cn } from '@/lib/cn';

export interface MacroSidebarProps {
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  targets: { kcal: number; protein: number; carbs: number; fat: number };
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

const MACROS = [
  { key: 'protein' as const, label: 'Bílkoviny', color: 'bg-blue', dotColor: 'bg-blue', calPerGram: 4 },
  { key: 'carbs' as const, label: 'Sacharidy', color: 'bg-orange', dotColor: 'bg-orange', calPerGram: 4 },
  { key: 'fat' as const, label: 'Tuky', color: 'bg-purple', dotColor: 'bg-purple', calPerGram: 9 },
] as const;

export function MacroSidebar({ totals, targets }: MacroSidebarProps) {
  const kcalRemaining = targets.kcal - totals.kcal;
  const totalMacroCals =
    totals.protein * 4 + totals.carbs * 4 + totals.fat * 9 || 1;

  return (
    <div>
      {/* Kcal section */}
      <div className="p-3 border-b border-border">
        <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
          Kalorie
        </div>
        <div className="text-[22px] font-bold text-text tracking-tight leading-none mb-[2px]">
          {totals.kcal.toLocaleString('cs-CZ')}
        </div>
        <div
          className={cn(
            'text-xs mb-1.5',
            kcalRemaining >= 0 ? 'text-green' : 'text-red',
          )}
        >
          {kcalRemaining >= 0
            ? `Zbývá ${kcalRemaining.toLocaleString('cs-CZ')} kcal`
            : `Překročeno o ${Math.abs(kcalRemaining).toLocaleString('cs-CZ')} kcal`}
        </div>

        {/* Stacked macro bar */}
        <div className="h-1.5 rounded-full overflow-hidden flex my-2 bg-bg3">
          {MACROS.map((m) => {
            const cals = totals[m.key] * m.calPerGram;
            const width = (cals / totalMacroCals) * 100;
            return (
              <div
                key={m.key}
                className={cn('h-full', m.color)}
                style={{ width: `${width}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Macro rows */}
      <div className="p-3">
        <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
          Makra
        </div>
        {MACROS.map((m) => (
          <div key={m.key} className="mb-2.5">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-text2 flex items-center gap-[5px]">
                <span
                  className={cn(
                    'w-[7px] h-[7px] rounded-[2px] shrink-0',
                    m.dotColor,
                  )}
                />
                {m.label}
              </div>
              <div className="text-xs tabular-nums">
                <span className="font-semibold text-text">
                  {Math.round(totals[m.key])} g
                </span>
                {' / '}
                <span className="text-text3">{Math.round(targets[m.key])} g</span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-bg3 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', m.color)}
                style={{ width: `${pct(totals[m.key], targets[m.key])}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
