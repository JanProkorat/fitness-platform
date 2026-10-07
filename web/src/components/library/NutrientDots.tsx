import { useTranslation } from 'react-i18next';

interface ItemProps {
  dotClassName: string;
  label: string;
}

function Item({ dotClassName, label }: ItemProps) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-1.5 shrink-0 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

/** Protein / carbs / fat / fibre with coloured dots, shared by the Ingredients and Recipes tables. */
export default function NutrientDots({ protein, carbs, fat, fibre }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-x-2.5 text-meta text-ink-2">
      <Item dotClassName="bg-macro-protein" label={t('library.nutrient.protein', { count: protein })} />
      <Item dotClassName="bg-macro-carbs" label={t('library.nutrient.carbs', { count: carbs })} />
      <Item dotClassName="bg-macro-fat" label={t('library.nutrient.fat', { count: fat })} />
      <Item dotClassName="bg-macro-fibre" label={t('library.nutrient.fibre', { count: fibre })} />
    </div>
  );
}
