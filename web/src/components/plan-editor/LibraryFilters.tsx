import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, SlidersHorizontal } from 'lucide-react';
import { useFoodTags } from '@/hooks/useIngredientsQueries';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CATEGORY_ORDER,
  countIngredientFilters,
  countRecipeFilters,
  DIETARY_PREFERENCES,
  EMPTY_INGREDIENT_FILTERS,
  EMPTY_RECIPE_FILTERS,
  MEAL_TYPES,
  OWNER_ORDER,
  toggleValue,
  type IngredientFilterState,
  type RecipeFilterState,
} from '@/components/plan-editor/plan-editor-library-filters';

interface TriggerProps {
  count: number;
}

/** The filter button next to the search field: dark with a count badge while filters are active. */
export function LibraryFiltersTrigger({ count }: TriggerProps) {
  const { t } = useTranslation();
  const active = count > 0;
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={t('planEditor.library.filters')}
        data-active={active}
        className={cn(
          'relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-field border outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
          active ? 'border-ink bg-ink text-primary-foreground' : 'border-line bg-card text-ink hover:bg-muted',
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {active && (
          <span
            data-testid="library-filter-count"
            className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-badge-min items-center justify-center rounded-full bg-nutrition px-1 text-caption font-bold text-on-nutrition"
          >
            {count}
          </span>
        )}
      </button>
    </PopoverTrigger>
  );
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
}

function ChipGroup<T extends string>({ label, options, selected, onChange }: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-label font-bold tracking-label text-muted-foreground uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleValue(selected, option.value))}
              className={cn(
                'inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-body font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                on ? 'border-ink bg-ink text-primary-foreground' : 'border-line bg-card text-ink hover:bg-muted',
              )}
            >
              {on && <Check className="size-3" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagChipGroup({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation();
  const tagsQuery = useFoodTags();
  const tags = (tagsQuery.data ?? []).filter((tag): tag is typeof tag & { tagId: string } => Boolean(tag.tagId));
  if (tags.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-label font-bold tracking-label text-muted-foreground uppercase">
          {t('library.tags.filter')}
        </span>
        <p className="text-body text-muted-foreground">
          {tagsQuery.isPending ? t('common.loading') : t('library.tags.empty')}
        </p>
      </div>
    );
  }
  return (
    <ChipGroup
      label={t('library.tags.filter')}
      options={tags.map((tag) => ({
        value: tag.tagId,
        label: (
          <>
            <span
              className="size-2 shrink-0 rounded-full bg-muted-foreground"
              style={tag.colorHex ? { backgroundColor: tag.colorHex } : undefined}
              aria-hidden="true"
            />
            {tag.name}
          </>
        ),
      }))}
      selected={selected}
      onChange={onChange}
    />
  );
}

interface ShellProps {
  count: number;
  matchCount: number | undefined;
  matchKey: 'planEditor.library.filtersPanel.recipesMatch' | 'planEditor.library.filtersPanel.ingredientsMatch';
  onClear: () => void;
  children: ReactNode;
}

function FiltersShell({ count, matchCount, matchKey, onClear, children }: ShellProps) {
  const { t } = useTranslation();
  return (
    <PopoverContent
      align="start"
      aria-label={t('planEditor.library.filtersPanel.title')}
      data-testid="library-filters"
      className="flex max-h-(--radix-popover-content-available-height) w-85 flex-col gap-3.5 overflow-y-auto rounded-xl p-4"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-copy font-bold text-ink">{t('planEditor.library.filtersPanel.title')}</span>
        {count > 0 && (
          <span className="inline-flex h-4.5 min-w-badge-min items-center justify-center rounded-full bg-nutrition px-1.25 text-caption font-bold text-on-nutrition">
            {count}
          </span>
        )}
        <button
          type="button"
          data-testid="library-filters-clear"
          onClick={onClear}
          className="ml-auto cursor-pointer rounded text-body font-semibold text-muted-foreground underline outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('planEditor.library.filtersPanel.clearAll')}
        </button>
      </div>
      {children}
      <p data-testid="library-filters-match" className="text-body text-muted-foreground">
        <b className="mr-1 text-ink">{matchCount ?? '…'}</b>
        {t(matchKey, { count: matchCount ?? 0 })}
      </p>
    </PopoverContent>
  );
}

interface RecipeProps {
  filters: RecipeFilterState;
  onChange: (next: RecipeFilterState) => void;
  matchCount: number | undefined;
}

/** Recipe filters: Meal type, Dietary preference, Owner, Tags. Applied live. */
export function RecipeFiltersContent({ filters, onChange, matchCount }: RecipeProps) {
  const { t } = useTranslation();
  return (
    <FiltersShell
      count={countRecipeFilters(filters)}
      matchCount={matchCount}
      matchKey="planEditor.library.filtersPanel.recipesMatch"
      onClear={() => onChange(EMPTY_RECIPE_FILTERS)}
    >
      <ChipGroup
        label={t('recipes.filters.mealType')}
        options={MEAL_TYPES.map((value) => ({ value, label: t(`recipes.mealType.${value}`) }))}
        selected={filters.mealTypes}
        onChange={(mealTypes) => onChange({ ...filters, mealTypes })}
      />
      <ChipGroup
        label={t('recipes.filters.dietaryPreference')}
        options={DIETARY_PREFERENCES.map((value) => ({ value, label: t(`ingredients.dietaryPreference.${value}`) }))}
        selected={filters.dietaryPreferences}
        onChange={(dietaryPreferences) => onChange({ ...filters, dietaryPreferences })}
      />
      <ChipGroup
        label={t('library.filters.owner')}
        options={OWNER_ORDER.map((value) => ({ value, label: t(`library.filters.ownerOptions.${value}`) }))}
        selected={filters.owners}
        onChange={(owners) => onChange({ ...filters, owners })}
      />
      <TagChipGroup selected={filters.tags} onChange={(tags) => onChange({ ...filters, tags })} />
    </FiltersShell>
  );
}

interface IngredientProps {
  filters: IngredientFilterState;
  onChange: (next: IngredientFilterState) => void;
  matchCount: number | undefined;
  /** Owner and Tags only exist for nutritionists, as on the Ingredients page. */
  isNutritionist: boolean;
}

/** Ingredient filters: Category, and for nutritionists Owner and Tags. Applied live. */
export function IngredientFiltersContent({ filters, onChange, matchCount, isNutritionist }: IngredientProps) {
  const { t } = useTranslation();
  return (
    <FiltersShell
      count={countIngredientFilters(filters, isNutritionist)}
      matchCount={matchCount}
      matchKey="planEditor.library.filtersPanel.ingredientsMatch"
      onClear={() => onChange(EMPTY_INGREDIENT_FILTERS)}
    >
      <ChipGroup
        label={t('ingredients.filters.category')}
        options={CATEGORY_ORDER.map((value) => ({ value, label: t(`ingredients.category.${value}`) }))}
        selected={filters.categories}
        onChange={(categories) => onChange({ ...filters, categories })}
      />
      {isNutritionist && (
        <>
          <ChipGroup
            label={t('library.filters.owner')}
            options={OWNER_ORDER.map((value) => ({ value, label: t(`library.filters.ownerOptions.${value}`) }))}
            selected={filters.owners}
            onChange={(owners) => onChange({ ...filters, owners })}
          />
          <TagChipGroup selected={filters.tags} onChange={(tags) => onChange({ ...filters, tags })} />
        </>
      )}
    </FiltersShell>
  );
}
