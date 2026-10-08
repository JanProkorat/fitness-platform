import { Trans, useTranslation } from 'react-i18next';
import { Apple, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import { foodDisplayName } from '@/components/plan-editor/plan-editor-library';
import { foodTotals, mealTotals, recipeTotals } from '@/components/plan-editor/plan-editor-nutrition';
import type { EditorMeal } from '@/components/plan-editor/plan-editor-types';

export interface DropSide {
  dayOfWeek: number;
  /** Row label key, e.g. `lunch`, as used under `planEditor.rows`. */
  rowLabelKey: string;
  meal: EditorMeal;
}

interface Props {
  /** The meal being copied and the filled meal it lands on; null keeps the dialog closed. */
  drop: { source: DropSide; target: DropSide } | null;
  language: string;
  onReplace: () => void;
  onAdd: () => void;
  onCancel: () => void;
}

interface Line {
  key: string;
  type: 'recipe' | 'food';
  name: string;
  kcal: number;
}

function mealLines(meal: EditorMeal, language: string): Line[] {
  return [
    ...meal.recipes.map((recipe, index) => ({
      key: `recipe:${index}`,
      type: 'recipe' as const,
      name: recipe.recipeName,
      kcal: recipeTotals(recipe).kcal,
    })),
    ...meal.foods.map((food, index) => ({
      key: `food:${index}`,
      type: 'food' as const,
      name: foodDisplayName(food, language),
      kcal: foodTotals(food).kcal,
    })),
  ];
}

/** Asks what a copied meal should do to the food already in the target cell. Escape and Cancel change nothing. */
export default function CardDropDialog({ drop, language, onReplace, onAdd, onCancel }: Props) {
  const { t } = useTranslation();
  const side = (value: DropSide) =>
    `${t(`planEditor.daysLong.${value.dayOfWeek}`)} · ${t(`planEditor.rows.${value.rowLabelKey}`)}`;
  const sourceLines = drop ? mealLines(drop.source.meal, language) : [];
  const targetLines = drop ? mealLines(drop.target.meal, language) : [];
  const sourceKcal = drop ? mealTotals(drop.source.meal).kcal : 0;
  const targetKcal = drop ? mealTotals(drop.target.meal).kcal : 0;
  const sourceNames = sourceLines.map((line) => line.name).join(', ');
  const targetNames = targetLines.map((line) => line.name).join(', ');
  const targetLabel = drop ? side(drop.target) : '';

  return (
    <Dialog open={drop !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-115" data-testid="card-drop-dialog">
        <DialogHeader>
          <DialogTitle>{t('planEditor.cardDrop.title', { target: targetLabel })}</DialogTitle>
          <DialogDescription>
            <Trans
              i18nKey="planEditor.cardDrop.body"
              values={{
                source: drop ? side(drop.source) : '',
                name: sourceNames,
                kcal: formatKcal(sourceKcal, language),
                target: targetLabel,
              }}
              components={{ b: <b className="font-semibold text-ink" /> }}
            />
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          <span className="pb-1 text-label font-semibold tracking-label text-muted-foreground uppercase">
            {t('planEditor.cardDrop.now', { target: targetLabel })}
          </span>
          <ul>
            {targetLines.map((line) => (
              <li key={line.key} className="flex items-center gap-2.5 border-t border-line py-1.5">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-nutrition-soft text-nutrition-ink"
                  aria-hidden="true"
                >
                  {line.type === 'recipe' ? <ChefHat className="size-3.5" /> : <Apple className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1 text-body font-medium text-ink [overflow-wrap:anywhere]">{line.name}</span>
                <span className="shrink-0 text-meta text-muted-foreground">
                  {t('planEditor.cell.kcal', { kcal: formatKcal(line.kcal, language) })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-nutrition-soft px-3 py-2.5 text-meta text-nutrition-ink">
          <span>
            <b>{t('planEditor.cardDrop.replaceLabel')}</b>
            {' — '}
            {t('planEditor.cardDrop.replaceBody', {
              target: targetLabel,
              names: sourceNames,
              kcal: formatKcal(sourceKcal, language),
            })}
          </span>
          <span>
            <b>{t('planEditor.cardDrop.addLabel')}</b>
            {' — '}
            {t('planEditor.cardDrop.addBody', {
              names: sourceNames,
              existing: targetNames,
              kcal: formatKcal(sourceKcal + targetKcal, language),
            })}
          </span>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onAdd}>
              {t('planEditor.cardDrop.addLabel')}
            </Button>
            <Button type="button" onClick={onReplace}>
              {t('planEditor.cardDrop.replaceLabel')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
