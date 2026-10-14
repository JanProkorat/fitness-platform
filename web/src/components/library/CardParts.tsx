import { useTranslation } from 'react-i18next';
import { Globe, Lock } from 'lucide-react';

interface PillProps {
  isOwnedByCurrentUser?: boolean;
}

/** Dark "My library" / "Public" pill on a grid card's picture (PageRecipesC). System and shared both read as Public. */
export function CardLibraryPill({ isOwnedByCurrentUser }: PillProps) {
  const { t } = useTranslation();
  const Icon = isOwnedByCurrentUser ? Lock : Globe;
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-scrim/60 px-2.5 text-meta font-semibold text-on-dark">
      <Icon className="size-3" aria-hidden="true" />
      {t(isOwnedByCurrentUser ? 'library.badge.myLibrary' : 'library.badge.publicLibrary')}
    </span>
  );
}

interface NutritionLineProps {
  kcal: number;
  /** Already-translated unit, e.g. "kcal / portion". */
  unit: string;
  protein: number;
  carbs: number;
  fat: number;
}

/** One-line "550 kcal / portion · P 45 · C 70 · F 10"; wraps rather than overflowing on narrow cards. */
export function CardNutritionLine({ kcal, unit, protein, carbs, fat }: NutritionLineProps) {
  const { t } = useTranslation();
  return (
    <span className="text-meta text-ink-2">
      <b className="text-body font-semibold text-ink">{kcal}</b> {unit} ·{' '}
      {t('library.cardMacros', { protein, carbs, fat })}
    </span>
  );
}
