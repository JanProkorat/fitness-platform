import { useTranslation } from 'react-i18next';

/// Props for the PlanToolbar component.
interface PlanToolbarProps {
  /// The name of the current plan.
  planName: string;
  /// Whether the plan has unsaved changes.
  isDirty: boolean;
  /// Whether a save operation is in progress.
  isSaving: boolean;
  /// The currently active tab.
  activeTab: 'mealPlan' | 'nutritionGoals';
  /// Callback to change the active tab.
  onTabChange: (tab: 'mealPlan' | 'nutritionGoals') => void;
  /// Callback to save the plan.
  onSave: () => void;
}

/// Top toolbar for the plan detail page, including plan name, save controls, and tab navigation.
export default function PlanToolbar({
  planName,
  isDirty,
  isSaving,
  activeTab,
  onTabChange,
  onSave,
}: PlanToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border bg-[#111111]">
      {/* Top bar: plan name + save controls */}
      <div className="flex items-center gap-4 px-6 py-3">
        <h1 className="flex-1 text-lg font-bold">{planName}</h1>

        <div className="flex items-center gap-3">
          {isSaving ? (
            <span className="text-xs text-text3">{t('nutrition.saving')}</span>
          ) : isDirty ? (
            <span className="flex items-center gap-1.5 text-xs text-yellow-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
              {t('nutrition.unsavedChanges')}
            </span>
          ) : (
            <span className="text-xs text-text3">{t('nutrition.allSaved')}</span>
          )}

          <button
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('nutrition.savePlan')}
          </button>
        </div>
      </div>

      {/* Tabs row */}
      <div className="flex items-center gap-0 px-6">
        {(
          [
            { key: 'mealPlan', label: t('nutrition.tabMealPlan') },
            { key: 'nutritionGoals', label: t('nutrition.tabNutritionGoals') },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`border-b-2 px-4 py-2.5 font-heading text-[12px] font-semibold uppercase tracking-wide transition-colors ${
              activeTab === key
                ? 'border-gold text-gold'
                : 'border-transparent text-text3 hover:text-text2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
