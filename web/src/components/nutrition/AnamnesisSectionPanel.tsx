import { useTranslation } from 'react-i18next';
import { Button, Select } from '@/components/ui';
import { PropertyList, Callout } from '@/components/data';
import { type CalculateGoalsRequest, type CalculateGoalsResponse } from '@/api/nutrition-goals';

const ACTIVITY_KEYS: Record<string, string> = {
  Sedentary: 'clients.values.Sedentary',
  LightlyActive: 'clients.values.LightlyActive',
  ModeratelyActive: 'clients.values.ModeratelyActive',
  VeryActive: 'clients.values.VeryActive',
  ExtremelyActive: 'clients.values.ExtremelyActive',
};

const GOAL_KEYS: Record<string, string> = {
  Cut: 'nutritionGoals.cutLabel',
  Maintain: 'nutritionGoals.maintainLabel',
  Bulk: 'nutritionGoals.bulkLabel',
};

const SEX_KEYS: Record<string, string> = {
  Male: 'nutritionGoals.sexMale',
  Female: 'nutritionGoals.sexFemale',
};

export interface AnamnesisSectionPanelProps {
  age: number;
  sex: 'Male' | 'Female';
  heightCm: number;
  weightKg: number;
  targetWeight: number;
  activityLevel: CalculateGoalsRequest['activityLevel'];
  goal: CalculateGoalsRequest['goal'];
  isCalculating: boolean;
  result: CalculateGoalsResponse | null;
  isNutritionist: boolean | undefined;
  onAgeChange: (value: number) => void;
  onSexChange: (value: 'Male' | 'Female') => void;
  onHeightChange: (value: number) => void;
  onWeightChange: (value: number) => void;
  onTargetWeightChange: (value: number) => void;
  onActivityLevelChange: (value: CalculateGoalsRequest['activityLevel']) => void;
  onGoalChange: (value: CalculateGoalsRequest['goal']) => void;
  onCalculate: () => void;
}

export function AnamnesisSectionPanel({
  age,
  sex,
  heightCm,
  weightKg,
  targetWeight,
  activityLevel,
  goal,
  isCalculating,
  result,
  isNutritionist,
  onAgeChange,
  onSexChange,
  onHeightChange,
  onWeightChange,
  onTargetWeightChange,
  onActivityLevelChange,
  onGoalChange,
  onCalculate,
}: AnamnesisSectionPanelProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text3 mb-2.5">
        {t('nutritionGoals.anamnesis')}
      </div>
      <div className="bg-bg2 border border-border rounded-md p-2 mb-4">
        <PropertyList
          className="mb-0"
          items={[
            {
              label: t('nutritionGoals.age'),
              icon: '📅',
              value: `${age}`,
              editable: true,
              onEdit: (v) => {
                const n = parseInt(v);
                if (!isNaN(n)) {
                  onAgeChange(n);
                }
              },
            },
            {
              label: t('nutritionGoals.sex'),
              icon: '👤',
              value: t(SEX_KEYS[sex] || sex),
              editable: true,
              onEdit: (v) => {
                const s = v.toLowerCase().startsWith('m') ? ('Male' as const) : ('Female' as const);
                onSexChange(s);
              },
            },
            {
              label: t('nutritionGoals.height'),
              icon: '📏',
              value: `${heightCm} cm`,
              editable: true,
              onEdit: (v) => {
                const n = parseFloat(v);
                if (!isNaN(n)) {
                  onHeightChange(n);
                }
              },
            },
            {
              label: t('nutritionGoals.weight'),
              icon: '⚖',
              value: `${weightKg} kg`,
              editable: true,
              onEdit: (v) => {
                const n = parseFloat(v);
                if (!isNaN(n)) {
                  onWeightChange(n);
                }
              },
            },
            {
              label: t('nutritionGoals.targetWeight'),
              icon: '🎯',
              value: `${targetWeight} kg`,
              editable: true,
              onEdit: (v) => {
                const n = parseFloat(v);
                if (!isNaN(n)) {
                  onTargetWeightChange(n);
                }
              },
            },
            {
              label: t('nutritionGoals.activityLevel'),
              icon: '⚡',
              value: t(ACTIVITY_KEYS[activityLevel] || activityLevel),
              editable: true,
              onEdit: (v) => {
                const match = Object.entries(ACTIVITY_KEYS).find(([, label]) =>
                  label.toLowerCase().startsWith(v.toLowerCase()),
                );
                if (match) {
                  const al = match[0] as CalculateGoalsRequest['activityLevel'];
                  onActivityLevelChange(al);
                }
              },
            },
          ]}
        />
      </div>

      <div className="text-[13px] font-semibold mb-2">{t('nutritionGoals.goal')}</div>
      <div className="mb-4">
        <Select
          value={goal}
          onChange={(e) => {
            const g = e.target.value as CalculateGoalsRequest['goal'];
            onGoalChange(g);
          }}
        >
          <option value="Cut">{t('nutritionGoals.cutLabel')}</option>
          <option value="Maintain">{t('nutritionGoals.maintainLabel')}</option>
          <option value="Bulk">{t('nutritionGoals.bulkLabel')}</option>
        </Select>
      </div>

      {!result && isNutritionist && (
        <Button
          variant="primary"
          onClick={onCalculate}
          disabled={isCalculating}
          className="w-full justify-center"
        >
          {isCalculating ? t('nutritionGoals.calculating') : t('nutritionGoals.calculate')}
        </Button>
      )}

      {result && isNutritionist && (
        <>
          <div className="text-[13px] font-semibold mb-2">{t('nutritionGoals.calculation')}</div>
          <Callout icon="🧮" title="Mifflin-St Jeor" variant="info" className="bg-bg2 border border-border">
            <div className="text-[13px] text-text2">
              {t('nutritionGoals.bmr')} = {Math.round(result.bmr).toLocaleString('cs')} kcal
              {' · '}
              {t('nutritionGoals.tdee')} = {Math.round(result.tdee).toLocaleString('cs')} kcal
              {' · '}
              {t(GOAL_KEYS[goal])}
              {' → '}
              <strong>{t('nutritionGoals.goalTarget')} {Math.round(result.adjustedKcal).toLocaleString('cs')} kcal</strong>
            </div>
          </Callout>
          <div className="text-[11px] text-text3 mt-2 leading-relaxed">
            {t('nutritionGoals.mifflinFormula')} {sex === 'Female' ? t('nutritionGoals.mifflinFemaleOffset') : t('nutritionGoals.mifflinMaleOffset')}.
            {' '}{t('nutritionGoals.tdeeFormula')}
          </div>
        </>
      )}
    </div>
  );
}
