interface NutrientValues {
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
}

interface MacroBadgesProps {
  nutrients: NutrientValues;
  round?: boolean;
}

export function MacroBadges({ nutrients: nv, round = false }: MacroBadgesProps) {
  const fmt = (v: number) => (round ? Math.round(v) : v);
  return (
    <span className="text-[12px] tabular-nums">
      <span style={{ color: 'var(--blue)' }}>{fmt(nv.protein)}g</span>
      {' / '}
      <span style={{ color: 'var(--orange)' }}>{fmt(nv.carbs)}g</span>
      {' / '}
      <span style={{ color: 'var(--purple)' }}>{fmt(nv.fat)}g</span>
      {nv.fiber ? <>{' / '}<span style={{ color: 'var(--green)' }}>{fmt(nv.fiber)}g</span></> : null}
    </span>
  );
}
