import { useTranslation } from 'react-i18next';
import type { MealFood } from '@/api/plan-types';

interface StagedFoodsTableProps {
  items: MealFood[];
  onRemove: (foodExternalId: string) => void;
  onUpdateAmount: (foodExternalId: string, amountGrams: number) => void;
}

export function StagedFoodsTable({ items, onRemove, onUpdateAmount }: StagedFoodsTableProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text3">
        {t('nutrition.searchFoods')} ({items.length})
      </label>
      <div className="rounded-sm border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase text-text3">
              <th className="px-3 py-2 font-medium">Food</th>
              <th className="w-20 px-2 py-2 font-medium">{t('nutrition.grams')}</th>
              <th className="w-14 px-2 py-2 text-right font-medium">kcal</th>
              <th className="w-10 px-2 py-2 text-right font-medium">P</th>
              <th className="w-10 px-2 py-2 text-right font-medium">C</th>
              <th className="w-10 px-2 py-2 text-right font-medium">F</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const scale = item.amountGrams / 100;
              return (
                <tr key={item.foodExternalId} className="border-t border-border">
                  <td className="truncate px-3 py-2 text-text2">{item.foodName}</td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={1}
                      value={item.amountGrams}
                      onChange={(e) =>
                        onUpdateAmount(
                          item.foodExternalId,
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                      className="w-16 rounded-sm border border-border bg-bg2 px-1.5 py-0.5 text-xs text-text outline-none focus:border-border-hv"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-text3">
                    {Math.round(item.nutrientValuePer100Grams.kcal * scale)}
                  </td>
                  <td className="px-2 py-2 text-right text-blue-400">
                    {Math.round(item.nutrientValuePer100Grams.protein * scale)}
                  </td>
                  <td className="px-2 py-2 text-right text-amber-400">
                    {Math.round(item.nutrientValuePer100Grams.carbs * scale)}
                  </td>
                  <td className="px-2 py-2 text-right text-rose-400">
                    {Math.round(item.nutrientValuePer100Grams.fat * scale)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => onRemove(item.foodExternalId)}
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
