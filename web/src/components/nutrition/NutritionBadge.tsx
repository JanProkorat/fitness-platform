interface NutritionBadgeProps {
  label: string;
  value: number;
  unit?: string;
  color: 'protein' | 'carbs' | 'fat' | 'kcal';
}

const colorMap: Record<NutritionBadgeProps['color'], string> = {
  protein: 'bg-blue-500/15 text-blue-400',
  carbs: 'bg-amber-500/15 text-amber-400',
  fat: 'bg-rose-500/15 text-rose-400',
  kcal: 'bg-green-500/15 text-green-400',
};

export default function NutritionBadge({ label, value, unit, color }: NutritionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${colorMap[color]}`}
    >
      {value}
      {unit} {label}
    </span>
  );
}
