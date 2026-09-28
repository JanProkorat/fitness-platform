import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorCode } from '@/lib/api-errors';
import {
  FoodCategory,
  Allergen,
  DietaryPreference,
  type FoodSummary,
  type CreateFoodRequest,
  type UpdateFoodRequest,
} from '@/api/food-types';
import { useCreateFood, useUpdateFood } from '@/hooks/useIngredientsQueries';
import MultiSelectPopover from '@/components/ingredients/MultiSelectPopover';
import TagsInput from '@/components/ingredients/TagsInput';
import DeleteIngredientDialog from '@/components/ingredients/DeleteIngredientDialog';

/** Fixed unit keys for the drawer's Unit select (design-review MINOR finding #8,
 * `docs/design/ingredients/inventory.md`). The label is stored verbatim as
 * `CommonServings[0].Label`; display translates the key and falls back to the
 * raw string for legacy seed data whose label doesn't match any key. */
export const UNIT_KEYS = ['portion', 'piece', 'slice', 'cup', 'tbsp', 'tsp', 'handful', 'glass', 'pack'] as const;
export type UnitKey = (typeof UNIT_KEYS)[number];

const CATEGORY_VALUES = Object.values(FoodCategory);
const ALLERGEN_VALUES = Object.values(Allergen);
const DIETARY_PREFERENCE_VALUES = Object.values(DietaryPreference);

// Numeric fields use `z.number()` (not `z.coerce.number()`) paired with
// `register(name, { valueAsNumber: true })` below — RHF converts the input
// string to a number before validation runs, so the schema's input and
// output types stay identical. `z.coerce.number()` would make the schema's
// *input* type `unknown` while its *output* type is `number`, which
// `@hookform/resolvers`'s `Resolver<FormValues>` cannot reconcile with a
// `useForm<FormValues>()` typed to the output shape (TS2322/TS2345 at build).
const formSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().refine((value) => CATEGORY_VALUES.includes(value as FoodCategory), { message: 'required' }),
  kcal: z.number({ message: 'required' }).min(0),
  protein: z.number({ message: 'required' }).min(0),
  carbs: z.number({ message: 'required' }).min(0),
  fat: z.number({ message: 'required' }).min(0),
  unit: z.string().refine((value) => (UNIT_KEYS as readonly string[]).includes(value), { message: 'required' }),
  servingSize: z.number({ message: 'required' }).positive(),
  dietaryPreferences: z.array(z.string()),
  allergens: z.array(z.string()),
  tags: z.array(z.string()).max(20),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_VALUES: FormValues = {
  name: '',
  category: '',
  kcal: undefined as unknown as number,
  protein: undefined as unknown as number,
  carbs: undefined as unknown as number,
  fat: undefined as unknown as number,
  unit: '',
  servingSize: undefined as unknown as number,
  dietaryPreferences: [],
  allergens: [],
  tags: [],
};

function valuesFromFood(food: FoodSummary): FormValues {
  const defaultServing = food.commonServings?.[0];
  return {
    name: food.name ?? '',
    category: food.category ?? '',
    kcal: food.nutrientValue?.kcal ?? (undefined as unknown as number),
    protein: food.nutrientValue?.protein ?? (undefined as unknown as number),
    carbs: food.nutrientValue?.carbs ?? (undefined as unknown as number),
    fat: food.nutrientValue?.fat ?? (undefined as unknown as number),
    unit: defaultServing?.label ?? '',
    servingSize: defaultServing?.weightGrams ?? (undefined as unknown as number),
    dietaryPreferences: (food.dietaryPreferences ?? []) as string[],
    allergens: (food.allergens ?? []) as string[],
    tags: food.tags ?? [],
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The food to edit or view. `null` opens the drawer in create mode. */
  food: FoodSummary | null;
  /** True for a system/shared food, or for a trainer-only coach viewing any row. */
  readOnly: boolean;
}

/**
 * Create / edit / read-only drawer for an ingredient. Mirrors `AddClientDrawer`
 * (`@/components/clients/AddClientDrawer.tsx`) — Sheet + React Hook Form + Zod,
 * mutation `onSuccess` closes the drawer, `onError` shows a toast (from the
 * mutation hook) plus an additive inline error for the one code that has a
 * natural field to attach to (KCAL_INCONSISTENT → the Calories field).
 *
 * Editing is a full-state PUT (`UpdateFoodEndpoint.cs:61-90`) — `onSubmit`
 * round-trips `nameEn`/`nameCs`/`nameDe`, `note`, `visibility` and any
 * `commonServings` beyond the default (index 0) straight from the loaded
 * `food`, since the drawer's own fields never touch them.
 */
export default function IngredientDrawer({ open, onOpenChange, food, readOnly }: Props) {
  const { t } = useTranslation();
  const mode = food === null ? 'create' : readOnly ? 'view' : 'edit';
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateFood();
  const updateMutation = useUpdateFood();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: EMPTY_VALUES,
  });

  // Fresh form state per open, sourced from the food currently selected —
  // same "adjust on open" pattern as AddClientDrawer, not a useMemo synced
  // to `food` alone, since re-opening the SAME food (e.g. after a failed
  // save) should also re-sync from the latest query data.
  useEffect(() => {
    if (open) {
      reset(food ? valuesFromFood(food) : EMPTY_VALUES);
    }
  }, [open, food, reset]);

  const dietaryPreferences = watch('dietaryPreferences');
  const allergens = watch('allergens');
  const tags = watch('tags');
  const unit = watch('unit');

  function onSubmit(values: FormValues) {
    const commonServings = [
      { label: values.unit, weightGrams: values.servingSize },
      ...(food?.commonServings ?? []).slice(1),
    ];

    if (mode === 'create') {
      const request: CreateFoodRequest = {
        name: values.name,
        nutrientValue: { kcal: values.kcal, protein: values.protein, carbs: values.carbs, fat: values.fat },
        category: values.category as FoodCategory,
        allergens: values.allergens as Allergen[],
        dietaryPreferences: values.dietaryPreferences as DietaryPreference[],
        tags: values.tags,
        commonServings,
      };
      createMutation.mutate(request, {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (getErrorCode(error) === 'KCAL_INCONSISTENT') {
            setError('kcal', { message: t('apiErrors.KCAL_INCONSISTENT') });
          }
        },
      });
      return;
    }

    if (!food?.foodId) {
      return;
    }

    const request: UpdateFoodRequest = {
      name: values.name,
      nameEn: food.nameEn,
      nameCs: food.nameCs,
      nameDe: food.nameDe,
      nutrientValue: { kcal: values.kcal, protein: values.protein, carbs: values.carbs, fat: values.fat },
      category: values.category as FoodCategory,
      note: food.note,
      visibility: food.visibility,
      allergens: values.allergens as Allergen[],
      dietaryPreferences: values.dietaryPreferences as DietaryPreference[],
      tags: values.tags,
      commonServings,
    };
    updateMutation.mutate(
      { foodId: food.foodId, request },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => {
          if (getErrorCode(error) === 'KCAL_INCONSISTENT') {
            setError('kcal', { message: t('apiErrors.KCAL_INCONSISTENT') });
          }
        },
      },
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {t(
                mode === 'create'
                  ? 'ingredients.drawer.createTitle'
                  : mode === 'view'
                    ? 'ingredients.drawer.viewTitle'
                    : 'ingredients.drawer.editTitle',
              )}
            </SheetTitle>
            <SheetDescription>{t('ingredients.drawer.subtitle')}</SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-4"
          >
            <fieldset disabled={readOnly} className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-body font-semibold text-foreground">{t('ingredients.drawer.basicInfo')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-name">{t('ingredients.drawer.name')}</Label>
                    <Input id="ingredient-name" {...register('name')} aria-invalid={!!errors.name} />
                    {errors.name && <p className="text-meta text-destructive">{t('ingredients.drawer.nameRequired')}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-category">{t('ingredients.drawer.category')}</Label>
                    <select
                      id="ingredient-category"
                      {...register('category')}
                      aria-invalid={!!errors.category}
                      className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                    >
                      <option value="">{t('ingredients.drawer.categoryPlaceholder')}</option>
                      {CATEGORY_VALUES.map((category) => (
                        <option key={category} value={category}>
                          {t(`ingredients.category.${category}`)}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="text-meta text-destructive">{t('ingredients.drawer.categoryRequired')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-body font-semibold text-foreground">{t('ingredients.drawer.nutritionalInfo')}</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-kcal">{t('ingredients.drawer.calories')}</Label>
                    <Input
                      id="ingredient-kcal"
                      type="number"
                      step="any"
                      {...register('kcal', { valueAsNumber: true })}
                      aria-invalid={!!errors.kcal}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-protein">{t('ingredients.drawer.protein')}</Label>
                    <Input
                      id="ingredient-protein"
                      type="number"
                      step="any"
                      {...register('protein', { valueAsNumber: true })}
                      aria-invalid={!!errors.protein}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-carbs">{t('ingredients.drawer.carbs')}</Label>
                    <Input
                      id="ingredient-carbs"
                      type="number"
                      step="any"
                      {...register('carbs', { valueAsNumber: true })}
                      aria-invalid={!!errors.carbs}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-fat">{t('ingredients.drawer.fat')}</Label>
                    <Input
                      id="ingredient-fat"
                      type="number"
                      step="any"
                      {...register('fat', { valueAsNumber: true })}
                      aria-invalid={!!errors.fat}
                    />
                  </div>
                </div>
                {errors.kcal && <p className="text-meta text-destructive">{errors.kcal.message}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-unit">{t('ingredients.drawer.unit')}</Label>
                    <select
                      id="ingredient-unit"
                      {...register('unit')}
                      aria-invalid={!!errors.unit}
                      className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                    >
                      <option value="">{t('ingredients.drawer.unitPlaceholder')}</option>
                      {UNIT_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {t(`ingredients.unit.${key}`)}
                        </option>
                      ))}
                      {unit && !(UNIT_KEYS as readonly string[]).includes(unit) && (
                        <option value={unit}>{unit}</option>
                      )}
                    </select>
                    {errors.unit && <p className="text-meta text-destructive">{t('ingredients.drawer.unitRequired')}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-serving-size">{t('ingredients.drawer.servingSize')}</Label>
                    <Input
                      id="ingredient-serving-size"
                      type="number"
                      step="any"
                      {...register('servingSize', { valueAsNumber: true })}
                      aria-invalid={!!errors.servingSize}
                    />
                    {errors.servingSize && (
                      <p className="text-meta text-destructive">{t('ingredients.drawer.servingSizeRequired')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-body font-semibold text-foreground">{t('ingredients.drawer.tagsClassification')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-dietary-preferences">{t('ingredients.drawer.dietaryPreferences')}</Label>
                    <MultiSelectPopover
                      id="ingredient-dietary-preferences"
                      placeholder={t('ingredients.drawer.dietaryPreferencesPlaceholder')}
                      options={DIETARY_PREFERENCE_VALUES.map((value) => ({
                        value,
                        label: t(`ingredients.dietaryPreference.${value}`),
                      }))}
                      selected={dietaryPreferences}
                      onChange={(values) => setValue('dietaryPreferences', values)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ingredient-allergens">{t('ingredients.drawer.allergens')}</Label>
                    <MultiSelectPopover
                      id="ingredient-allergens"
                      placeholder={t('ingredients.drawer.allergensPlaceholder')}
                      options={ALLERGEN_VALUES.map((value) => ({ value, label: t(`ingredients.allergen.${value}`) }))}
                      selected={allergens}
                      onChange={(values) => setValue('allergens', values)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ingredient-tags">{t('ingredients.drawer.tags')}</Label>
                  <TagsInput id="ingredient-tags" value={tags} onChange={(values) => setValue('tags', values)} />
                  {errors.tags && <p className="text-meta text-destructive">{errors.tags.message}</p>}
                </div>
              </div>
            </fieldset>
          </form>

          <SheetFooter className="flex-row justify-between">
            {mode === 'edit' ? (
              <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                {t('ingredients.drawer.delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {mode === 'view' ? t('common.close') : t('common.cancel')}
              </Button>
              {mode !== 'view' && (
                <Button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)}>
                  {t('ingredients.drawer.save')}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {food?.foodId && (
        <DeleteIngredientDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          foodId={food.foodId}
          foodName={food.name ?? ''}
          onDeleted={() => {
            setDeleteOpen(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
