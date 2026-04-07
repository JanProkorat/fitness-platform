import { useTranslation } from 'react-i18next';

interface MacroProgressBarProps {
  label: string;
  current: number;
  target: number;
  color: 'protein' | 'carbs' | 'fat' | 'fiber' | 'kcal';
}

const colorMap: Record<MacroProgressBarProps['color'], string> = {
  protein: 'bg-blue-400',
  carbs: 'bg-amber-400',
  fat: 'bg-rose-400',
  fiber: 'bg-green-400',
  kcal: 'bg-green-400',
};

const textColorMap: Record<MacroProgressBarProps['color'], string> = {
  protein: 'text-blue-400',
  carbs: 'text-amber-400',
  fat: 'text-rose-400',
  fiber: 'text-green-400',
  kcal: 'text-green-400',
};

export default function MacroProgressBar({
  label,
  current,
  target,
  color,
}: MacroProgressBarProps) {
  const { t } = useTranslation();
  const pct = target > 0 ? (current / target) * 100 : 0;
  const isOver = pct > 100;
  const clampedPct = Math.min(pct, 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={`font-semibold ${textColorMap[color]}`}>{label}</span>
        <span className="text-text3">
          {Math.round(current)}/{Math.round(target)}
          {isOver && (
            <span className="ml-1 text-red-400">{t('nutrition.overTarget')}</span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg3">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : colorMap[color]}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
}
