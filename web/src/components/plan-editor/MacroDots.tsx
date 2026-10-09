import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const MACROS = [
  { key: 'protein', dotClass: 'bg-macro-protein' },
  { key: 'carbs', dotClass: 'bg-macro-carbs' },
  { key: 'fat', dotClass: 'bg-macro-fat' },
  { key: 'fiber', dotClass: 'bg-macro-fibre' },
] as const;

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  /** Omit to leave fiber out. */
  fiber?: number;
  /** Adds a trailing "g" to the fiber value (totals rows). */
  fiberUnit?: boolean;
  className?: string;
}

/** Protein, carbs, fat and fiber as coloured dots with a short label and a rounded value. */
export default function MacroDots({ protein, carbs, fat, fiber, fiberUnit = false, className }: Props) {
  const { t } = useTranslation();
  const values = { protein, carbs, fat, fiber };

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5', className)}>
      {MACROS.map(({ key, dotClass }) => {
        const value = values[key];
        if (value === undefined) {
          return null;
        }
        return (
          <span key={key} className="inline-flex items-center gap-1.25 whitespace-nowrap">
            <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
            {t(`planEditor.macroShort.${key}`)} {Math.round(value)}
            {key === 'fiber' && fiberUnit ? ` ${t('planEditor.units.g')}` : ''}
          </span>
        );
      })}
    </span>
  );
}
