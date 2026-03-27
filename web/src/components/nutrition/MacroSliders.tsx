import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface MacroSlidersProps {
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  totalKcal: number;
  onChange: (protein: number, carbs: number, fat: number) => void;
}

const COLORS = {
  protein: '#60a5fa', // blue-400
  carbs: '#fbbf24', // amber-400
  fat: '#fb7185', // rose-400
};

function DonutChart({
  protein,
  carbs,
  fat,
  totalKcal,
}: {
  protein: number;
  carbs: number;
  fat: number;
  totalKcal: number;
}) {
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = protein + carbs + fat || 1;
  const proteinArc = (protein / total) * circumference;
  const carbsArc = (carbs / total) * circumference;
  const fatArc = (fat / total) * circumference;

  const proteinOffset = 0;
  const carbsOffset = -(proteinArc);
  const fatOffset = -(proteinArc + carbsArc);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
      />
      {/* Fat segment */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={COLORS.fat}
        strokeWidth={strokeWidth}
        strokeDasharray={`${fatArc} ${circumference - fatArc}`}
        strokeDashoffset={fatOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="butt"
      />
      {/* Carbs segment */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={COLORS.carbs}
        strokeWidth={strokeWidth}
        strokeDasharray={`${carbsArc} ${circumference - carbsArc}`}
        strokeDashoffset={carbsOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="butt"
      />
      {/* Protein segment */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={COLORS.protein}
        strokeWidth={strokeWidth}
        strokeDasharray={`${proteinArc} ${circumference - proteinArc}`}
        strokeDashoffset={proteinOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="butt"
      />
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
        className="fill-text text-xl font-bold"
        fontSize="22"
      >
        {Math.round(totalKcal)}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        className="fill-text3 text-xs"
        fontSize="12"
      >
        kcal
      </text>
    </svg>
  );
}

export default function MacroSliders({
  proteinPercent,
  carbsPercent,
  fatPercent,
  totalKcal,
  onChange,
}: MacroSlidersProps) {
  const { t } = useTranslation();

  const proteinGrams = Math.round((totalKcal * proteinPercent) / 100 / 4);
  const carbsGrams = Math.round((totalKcal * carbsPercent) / 100 / 4);
  const fatGrams = Math.round((totalKcal * fatPercent) / 100 / 9);

  const handleChange = useCallback(
    (macro: 'protein' | 'carbs' | 'fat', value: number) => {
      let p = proteinPercent;
      let c = carbsPercent;
      let f = fatPercent;

      if (macro === 'protein') {
        const delta = value - p;
        p = value;
        const otherTotal = c + f;
        if (otherTotal > 0) {
          c = Math.max(0, Math.round(c - (delta * c) / otherTotal));
          f = 100 - p - c;
        } else {
          c = Math.round((100 - p) / 2);
          f = 100 - p - c;
        }
      } else if (macro === 'carbs') {
        const delta = value - c;
        c = value;
        const otherTotal = p + f;
        if (otherTotal > 0) {
          p = Math.max(0, Math.round(p - (delta * p) / otherTotal));
          f = 100 - p - c;
        } else {
          p = Math.round((100 - c) / 2);
          f = 100 - p - c;
        }
      } else {
        const delta = value - f;
        f = value;
        const otherTotal = p + c;
        if (otherTotal > 0) {
          p = Math.max(0, Math.round(p - (delta * p) / otherTotal));
          c = 100 - p - f;
        } else {
          p = Math.round((100 - f) / 2);
          c = 100 - p - f;
        }
      }

      // Clamp
      p = Math.max(0, Math.min(100, p));
      c = Math.max(0, Math.min(100, c));
      f = Math.max(0, Math.min(100, f));

      onChange(p, c, f);
    },
    [proteinPercent, carbsPercent, fatPercent, onChange],
  );

  const macros = [
    {
      key: 'protein' as const,
      label: t('nutritionGoals.protein'),
      percent: proteinPercent,
      grams: proteinGrams,
      color: COLORS.protein,
      bgClass: 'bg-blue-400',
    },
    {
      key: 'carbs' as const,
      label: t('nutritionGoals.carbs'),
      percent: carbsPercent,
      grams: carbsGrams,
      color: COLORS.carbs,
      bgClass: 'bg-amber-400',
    },
    {
      key: 'fat' as const,
      label: t('nutritionGoals.fat'),
      percent: fatPercent,
      grams: fatGrams,
      color: COLORS.fat,
      bgClass: 'bg-rose-400',
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-accent">
        {t('nutritionGoals.macroSplit')}
      </h2>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Donut chart */}
        <div className="shrink-0">
          <DonutChart
            protein={proteinPercent}
            carbs={carbsPercent}
            fat={fatPercent}
            totalKcal={totalKcal}
          />
        </div>

        {/* Sliders */}
        <div className="flex-1 space-y-4 w-full">
          {macros.map((m) => (
            <div key={m.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.label}
                </span>
                <span className="font-mono text-xs text-text3">
                  {m.percent}% &middot; {m.grams}
                  {t('nutritionGoals.grams')}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={m.percent}
                onChange={(e) =>
                  handleChange(m.key, parseInt(e.target.value, 10))
                }
                className="w-full accent-accent"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
