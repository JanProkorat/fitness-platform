import { useTranslation } from 'react-i18next';
import type { StagedRecipe } from './AddItemsDrawer-types';

interface StagedRecipesTableProps {
  items: StagedRecipe[];
  onRemove: (recipeId: string) => void;
  onUpdatePortions: (recipeId: string, portions: number) => void;
}

export function StagedRecipesTable({ items, onRemove, onUpdatePortions }: StagedRecipesTableProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text3">
        {t('recipes.fromRecipe')} ({items.length})
      </label>
      <div className="rounded-sm border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase text-text3">
              <th className="px-3 py-2 font-medium">{t('recipes.fromRecipe')}</th>
              <th className="w-20 px-2 py-2 font-medium">{t('recipes.portions')}</th>
              <th className="w-14 px-2 py-2 text-right font-medium">kcal</th>
              <th className="w-10 px-2 py-2 text-right font-medium">P</th>
              <th className="w-10 px-2 py-2 text-right font-medium">C</th>
              <th className="w-10 px-2 py-2 text-right font-medium">F</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((sr) => {
              const tn = sr.recipe.totalNutrients;
              return (
                <tr key={sr.recipe.recipeId} className="border-t border-border">
                  <td className="truncate px-3 py-2 text-text2">{sr.recipe.name}</td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={sr.portions}
                      onChange={(e) =>
                        onUpdatePortions(
                          sr.recipe.recipeId,
                          Math.max(0.25, Number(e.target.value) || 1),
                        )
                      }
                      className="w-16 rounded-sm border border-border bg-bg2 px-1.5 py-0.5 text-xs text-text outline-none focus:border-border-hv"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-text3">
                    {Math.round(tn.kcal * sr.portions)}
                  </td>
                  <td className="px-2 py-2 text-right text-blue-400">
                    {Math.round(tn.protein * sr.portions)}
                  </td>
                  <td className="px-2 py-2 text-right text-amber-400">
                    {Math.round(tn.carbs * sr.portions)}
                  </td>
                  <td className="px-2 py-2 text-right text-rose-400">
                    {Math.round(tn.fat * sr.portions)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => onRemove(sr.recipe.recipeId)}
                      className="text-text3 transition-colors hover:text-red-400"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
