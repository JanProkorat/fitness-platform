import { useTranslation } from 'react-i18next';
import { type MealKind, MEAL_KIND_CONFIG } from './meal-kind';

export function MealKindBadge({ kind }: { kind: string }) {
  const { t } = useTranslation();
  const config = MEAL_KIND_CONFIG[kind as MealKind];
  if (!config) return <span style={{ fontSize: 12, color: 'var(--text3)' }}>{kind}</span>;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12,
      fontSize: 12, fontWeight: 500,
      color: config.color,
      background: `color-mix(in srgb, ${config.color} 10%, transparent)`,
    }}>
      <span>{config.icon}</span>
      {t(`mealKind.${kind}`)}
    </span>
  );
}
