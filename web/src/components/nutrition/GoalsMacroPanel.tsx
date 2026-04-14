import { useTranslation } from 'react-i18next';
import { PropertyList } from '@/components/data';
import { ProgressBar } from '@/components/ui';
import { type CalculateGoalsResponse } from '@/api/nutrition-goals';

export interface GoalsMacroPanelProps {
  kcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  proteinDistributionPercent: number;
  carbsDistributionPercent: number;
  fatDistributionPercent: number;
  result: CalculateGoalsResponse | null;
  onProteinGramsChange: (value: number) => void;
  onCarbsGramsChange: (value: number) => void;
  onFatGramsChange: (value: number) => void;
  onProteinDistributionChange: (value: number) => void;
  onCarbsDistributionChange: (value: number) => void;
  onFatDistributionChange: (value: number) => void;
}

export function GoalsMacroPanel({
  kcal,
  proteinGrams,
  carbsGrams,
  fatGrams,
  proteinPercent,
  carbsPercent,
  fatPercent,
  proteinDistributionPercent,
  carbsDistributionPercent,
  fatDistributionPercent,
  result,
  onProteinGramsChange,
  onCarbsGramsChange,
  onFatGramsChange,
  onProteinDistributionChange,
  onCarbsDistributionChange,
  onFatDistributionChange,
}: GoalsMacroPanelProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
        {t('nutritionGoals.targetMacros')}
      </div>

      {result ? (
        <>
          <div className="bg-bg2 border border-border rounded-md p-2 mb-3.5">
            <PropertyList
              className="mb-0"
              items={[
                {
                  label: t('nutritionGoals.caloriesPerDay'),
                  value: (
                    <span className="font-semibold">
                      {Math.round(kcal).toLocaleString('cs')} kcal
                    </span>
                  ),
                },
                {
                  label: t('nutritionGoals.protein'),
                  icon: '',
                  value: (
                    <span className="flex items-center gap-2">
                      <span className="w-[7px] h-[7px] rounded-sm bg-blue shrink-0" />
                      <span className="font-semibold text-blue">{proteinGrams} g</span>
                      <span className="text-xs text-text3">{proteinPercent} %</span>
                    </span>
                  ),
                  editable: true,
                  onEdit: (v) => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 5 && n <= 60) {
                      onProteinGramsChange(n);
                    }
                  },
                },
                {
                  label: t('nutritionGoals.carbs'),
                  icon: '',
                  value: (
                    <span className="flex items-center gap-2">
                      <span className="w-[7px] h-[7px] rounded-sm bg-orange shrink-0" />
                      <span className="font-semibold text-orange">{carbsGrams} g</span>
                      <span className="text-xs text-text3">{carbsPercent} %</span>
                    </span>
                  ),
                  editable: true,
                  onEdit: (v) => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 5 && n <= 70) {
                      onCarbsGramsChange(n);
                    }
                  },
                },
                {
                  label: t('nutritionGoals.fat'),
                  icon: '',
                  value: (
                    <span className="flex items-center gap-2">
                      <span className="w-[7px] h-[7px] rounded-sm bg-purple shrink-0" />
                      <span className="font-semibold text-purple">{fatGrams} g</span>
                      <span className="text-xs text-text3">{fatPercent} %</span>
                    </span>
                  ),
                  editable: true,
                  onEdit: (v) => {
                    const n = parseInt(v);
                    if (!isNaN(n) && n >= 5 && n <= 50) {
                      onFatGramsChange(n);
                    }
                  },
                },
              ]}
            />
          </div>

          {/* Stacked macro bar */}
          <div className="h-[10px] rounded-full overflow-hidden flex mb-1.5">
            <div style={{ width: `${proteinPercent}%` }} className="bg-blue" />
            <div style={{ width: `${carbsPercent}%` }} className="bg-orange" />
            <div style={{ width: `${fatPercent}%` }} className="bg-purple" />
          </div>
          <div className="flex gap-3 flex-wrap text-[11px] text-text3 mb-6">
            <span className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-sm bg-blue inline-block" />
              {t('nutritionGoals.protein')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-sm bg-orange inline-block" />
              {t('nutritionGoals.carbs')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-sm bg-purple inline-block" />
              {t('nutritionGoals.fat')}
            </span>
          </div>

          {/* Detailed macro progress bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-text2 flex items-center gap-1.5">
                  <span className="w-[7px] h-[7px] rounded-sm bg-blue" />
                  {t('nutritionGoals.protein')}
                </span>
                <span className="text-xs tabular-nums">
                  <span className="font-semibold text-text">{proteinGrams}g</span>
                  <span className="text-text3"> / {proteinGrams}g</span>
                </span>
              </div>
              <ProgressBar value={100} color="var(--blue)" height={4} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-text2 flex items-center gap-1.5">
                  <span className="w-[7px] h-[7px] rounded-sm bg-orange" />
                  {t('nutritionGoals.carbs')}
                </span>
                <span className="text-xs tabular-nums">
                  <span className="font-semibold text-text">{carbsGrams}g</span>
                  <span className="text-text3"> / {carbsGrams}g</span>
                </span>
              </div>
              <ProgressBar value={100} color="var(--orange)" height={4} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-text2 flex items-center gap-1.5">
                  <span className="w-[7px] h-[7px] rounded-sm bg-purple" />
                  {t('nutritionGoals.fat')}
                </span>
                <span className="text-xs tabular-nums">
                  <span className="font-semibold text-text">{fatGrams}g</span>
                  <span className="text-text3"> / {fatGrams}g</span>
                </span>
              </div>
              <ProgressBar value={100} color="var(--purple)" height={4} />
            </div>
          </div>

          {/* Macro sliders */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {t('nutritionGoals.macroDistribution')}
            </div>
            {([
              { label: t('nutritionGoals.protein'), value: proteinDistributionPercent, set: onProteinDistributionChange, color: 'var(--blue)', max: 60 },
              { label: t('nutritionGoals.carbs'), value: carbsDistributionPercent, set: onCarbsDistributionChange, color: 'var(--orange)', max: 70 },
              { label: t('nutritionGoals.fat'), value: fatDistributionPercent, set: onFatDistributionChange, color: 'var(--purple)', max: 50 },
            ] as const).map((s) => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value} %</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={s.max}
                  value={s.value}
                  onChange={(e) => s.set(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: s.color, cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[13px] text-text3 py-8 text-center">
          {t('nutritionGoals.notCalculated')}
        </div>
      )}
    </div>
  );
}
