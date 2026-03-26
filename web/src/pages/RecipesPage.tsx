import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe } from '@/api/recipes';
import { searchFoods } from '@/api/foods';
import type { RecipeSummary, RecipeDetail } from '@/api/recipe-types';
import type { FoodSummary } from '@/api/food-types';
import NutritionBadge from '@/components/nutrition/NutritionBadge';
import { showApiError, showSuccess } from '@/lib/api-errors';
import TiptapEditor from '@/components/TiptapEditor';

/** Local form state for a food ingredient in the recipe editor. */
interface IngredientRow {
  foodExternalId: string;
  foodName: string;
  nutrientValuePer100Grams: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  pieces: number;
  servingWeightGrams: number;
  servingLabel: string;
}

type DrawerMode = { type: 'add' } | { type: 'edit'; recipeId: string } | null;

export default function RecipesPage() {
  const { t } = useTranslation();

  // List state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Drawer state
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodSummary[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [foodInputFocused, setFoodInputFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ recipeId: string; name: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['recipes', debouncedSearch, page],
    queryFn: () =>
      searchRecipes({
        search: debouncedSearch || undefined,
        page,
        pageSize: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      showSuccess('recipes.deleted');
      refetch();
    },
    onError: (error) => showApiError(error, 'recipes.deleteError'),
  });

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  // Calculate totals from ingredients
  const totals = ingredients.reduce(
    (acc, item) => {
      const ratio = (item.pieces * item.servingWeightGrams) / 100;
      return {
        kcal: acc.kcal + item.nutrientValuePer100Grams.kcal * ratio,
        protein: acc.protein + item.nutrientValuePer100Grams.protein * ratio,
        carbs: acc.carbs + item.nutrientValuePer100Grams.carbs * ratio,
        fat: acc.fat + item.nutrientValuePer100Grams.fat * ratio,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // Load food results for the drawer search (debounced, or immediately if empty)
  const loadFoodResults = useCallback(async (query: string) => {
    setFoodSearchLoading(true);
    try {
      const data = await searchFoods({ q: query || undefined, pageSize: 15, excludeExternal: true });
      setFoodResults(data.foods ?? []);
    } catch {
      setFoodResults([]);
    } finally {
      setFoodSearchLoading(false);
    }
  }, []);

  // Load initial food list when drawer opens
  useEffect(() => {
    if (drawerMode && !loadingDetail) {
      loadFoodResults('');
    }
  }, [drawerMode, loadingDetail, loadFoodResults]);

  // Debounce food search as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (drawerMode) loadFoodResults(foodQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [foodQuery, drawerMode, loadFoodResults]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIngredients([]);
    setFoodQuery('');
    setFoodResults([]);
    setFoodInputFocused(false);
  };

  const openDrawer = useCallback((mode: NonNullable<DrawerMode>) => {
    setDrawerMode(mode);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerVisible(false);
    setTimeout(() => {
      setDrawerMode(null);
      resetForm();
    }, 300);
  }, []);

  const openCreate = () => {
    resetForm();
    openDrawer({ type: 'add' });
  };

  const openEdit = async (recipe: RecipeSummary) => {
    resetForm();
    openDrawer({ type: 'edit', recipeId: recipe.recipeId });
    setLoadingDetail(true);
    try {
      const detail: RecipeDetail = await getRecipe(recipe.recipeId);
      setName(detail.name);
      setDescription(detail.description);
      setIngredients(
        detail.foods.map((f) => {
          // When loading from backend, we only have amountGrams — treat as 1 piece of that weight
          return {
            foodExternalId: f.foodExternalId,
            foodName: f.foodName,
            nutrientValuePer100Grams: {
              kcal: f.nutrientValuePer100Grams.kcal,
              protein: f.nutrientValuePer100Grams.protein,
              carbs: f.nutrientValuePer100Grams.carbs,
              fat: f.nutrientValuePer100Grams.fat,
            },
            pieces: 1,
            servingWeightGrams: f.amountGrams,
            servingLabel: `${f.amountGrams}g`,
          };
        }),
      );
    } catch (err) {
      showApiError(err, 'recipes.updateError');
      closeDrawer();
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleFoodSelect = (food: FoodSummary) => {
    const serving = food.commonServings?.[0];
    setIngredients((prev) => [
      ...prev,
      {
        foodExternalId: food.foodId,
        foodName: food.name,
        nutrientValuePer100Grams: {
          kcal: food.nutrientValue.kcal,
          protein: food.nutrientValue.protein,
          carbs: food.nutrientValue.carbs,
          fat: food.nutrientValue.fat,
        },
        pieces: 1,
        servingWeightGrams: serving?.weightGrams ?? 100,
        servingLabel: serving?.label ?? '100g',
      },
    ]);
  };

  const updateIngredientPieces = (index: number, pieces: number) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, pieces } : item)),
    );
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || ingredients.length === 0) return;

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      foods: ingredients.map((item) => ({
        foodExternalId: item.foodExternalId,
        amountGrams: item.pieces * item.servingWeightGrams,
      })),
    };

    try {
      if (drawerMode?.type === 'edit') {
        await updateRecipe(drawerMode.recipeId, payload);
        showSuccess('recipes.updated');
      } else {
        await createRecipe(payload);
        showSuccess('recipes.created');
      }
      closeDrawer();
      refetch();
    } catch (err) {
      showApiError(err, drawerMode?.type === 'edit' ? 'recipes.updateError' : 'recipes.createError');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, recipe: RecipeSummary) => {
    e.stopPropagation();
    setConfirmDelete({ recipeId: recipe.recipeId, name: recipe.name });
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.recipeId);
      setConfirmDelete(null);
    }
  };

  const inputClass =
    'rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-gold/40';

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('recipes.title')}</h1>
          <p className="text-xs text-muted">{t('recipes.subtitle')}</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
        >
          {t('recipes.addRecipe')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Search bar */}
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('recipes.search')}
              className="w-full rounded-sm border border-border bg-surface px-4 py-2.5 pl-10 text-sm text-text outline-none transition-colors focus:border-gold/40"
            />
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Recipe table */}
        <div className="rounded-sm border border-border bg-surface">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-text3">
              {t('common.loading')}
            </div>
          ) : !data?.recipes?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-text3">
              <span className="text-4xl">&#x1F373;</span>
              <p className="mt-3 text-sm">{t('recipes.noRecipes')}</p>
              <p className="mt-1 text-xs text-muted">{t('recipes.noRecipesHint')}</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_60px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('recipes.recipeName')}</span>
                <span className="lbl">{t('recipes.foods')}</span>
                <span className="lbl">{t('foods.kcal')}</span>
                <span className="lbl">{t('foods.protein')}</span>
                <span className="lbl">{t('foods.carbs')}</span>
                <span className="lbl">{t('foods.fat')}</span>
                <span className="lbl" />
              </div>

              {/* Rows */}
              {data.recipes.map((recipe) => (
                <div
                  key={recipe.recipeId}
                  onClick={() => openEdit(recipe)}
                  className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_60px] cursor-pointer items-center gap-4 border-b border-charcoal px-5 py-3 transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <span className="truncate text-sm font-semibold">{recipe.name}</span>
                  <span className="text-sm text-text2">{recipe.foodCount}</span>
                  <span className="text-sm text-text2">
                    <NutritionBadge
                      label=""
                      value={recipe.totalNutrients.kcal}
                      color="kcal"
                    />
                  </span>
                  <span className="text-sm text-text2">
                    {Math.round(recipe.totalNutrients.protein)}g
                  </span>
                  <span className="text-sm text-text2">
                    {Math.round(recipe.totalNutrients.carbs)}g
                  </span>
                  <span className="text-sm text-text2">
                    {Math.round(recipe.totalNutrients.fat)}g
                  </span>
                  <div className="text-center">
                    <button
                      onClick={(e) => handleDeleteClick(e, recipe)}
                      disabled={deleteMutation.isPending}
                      className="rounded-sm p-1 text-text3 transition-colors hover:text-red disabled:opacity-30"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <span className="text-xs text-muted">
                    {t('common.page', { current: page, total: totalPages })} &middot;{' '}
                    {t('common.total', { count: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      &larr; {t('common.previous')}
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-sm border border-border px-3 py-1 text-xs text-text3 transition-colors hover:text-gold disabled:opacity-30"
                    >
                      {t('common.next')} &rarr;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right-side drawer for create/edit */}
      {drawerMode && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${drawerVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div
            className={`fixed top-0 right-0 z-50 flex h-full w-[1000px] max-w-[90vw] flex-col border-l border-border bg-bg shadow-2xl transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-6">
              {/* Drawer header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {drawerMode.type === 'edit' ? t('recipes.editRecipe') : t('recipes.addRecipe')}
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="text-text3 transition-colors hover:text-text"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-20 text-text3">
                  {t('common.loading')}
                </div>
              ) : (
                <form id="recipe-form" onSubmit={handleSave} className="flex flex-col gap-5">
                  {/* Name */}
                  <div>
                    <label className="mb-1 block font-heading text-xs text-text3">
                      {t('recipes.recipeName')}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('recipes.recipeNamePlaceholder')}
                      required
                      className={`w-full ${inputClass}`}
                    />
                  </div>

                  {/* Food search dropdown */}
                  <div className="relative">
                    <label className="mb-1 block font-heading text-xs text-text3">
                      {t('recipes.addFood')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={foodQuery}
                        onChange={(e) => setFoodQuery(e.target.value)}
                        onFocus={() => setFoodInputFocused(true)}
                        onBlur={() => setFoodInputFocused(false)}
                        placeholder={t('nutrition.searchFoods')}
                        className={`w-full pl-10 ${inputClass}`}
                      />
                      <svg
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {foodSearchLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text3">
                          {t('common.loading')}
                        </span>
                      )}
                    </div>

                    {/* Dropdown results */}
                    {foodInputFocused && foodResults.length > 0 && (
                      <div
                        className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-border bg-surface shadow-lg"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {foodResults.map((food) => {
                          const alreadyAdded = ingredients.some((i) => i.foodExternalId === food.foodId);
                          return (
                            <button
                              key={food.foodId}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handleFoodSelect(food)}
                              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${alreadyAdded ? 'cursor-default opacity-40' : 'hover:bg-gold/5'}`}
                            >
                              <span className="truncate font-medium">{food.name}</span>
                              <span className="ml-3 shrink-0 text-xs text-text3">
                                {Math.round(food.nutrientValue.kcal)} kcal
                                {' · '}P {Math.round(food.nutrientValue.protein)}g
                                {' · '}C {Math.round(food.nutrientValue.carbs)}g
                                {' · '}F {Math.round(food.nutrientValue.fat)}g
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {foodInputFocused && !foodSearchLoading && foodQuery.trim() && foodResults.length === 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-sm border border-border bg-surface px-4 py-3 text-center text-xs text-text3 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                        {t('foods.noFoods')}
                      </div>
                    )}
                  </div>

                  {/* Ingredients table */}
                  {ingredients.length > 0 && (
                    <div className="rounded-sm border border-border bg-surface">
                      {/* Table header */}
                      <div className="grid grid-cols-[1fr_70px_140px_70px_80px_80px_80px_80px_40px] gap-3 border-b border-border px-4 py-2">
                        <span className="lbl">{t('common.name')}</span>
                        <span className="lbl">{t('recipes.pieces')}</span>
                        <span className="lbl">{t('recipes.serving')}</span>
                        <span className="lbl">{t('nutrition.grams')}</span>
                        <span className="lbl">{t('foods.kcal')}</span>
                        <span className="lbl">{t('foods.protein')}</span>
                        <span className="lbl">{t('foods.carbs')}</span>
                        <span className="lbl">{t('foods.fat')}</span>
                        <span />
                      </div>

                      {/* Ingredient rows */}
                      {ingredients.map((item, idx) => {
                        const grams = item.pieces * item.servingWeightGrams;
                        const ratio = grams / 100;
                        return (
                          <div
                            key={`${item.foodExternalId}-${idx}`}
                            className="grid grid-cols-[1fr_70px_140px_70px_80px_80px_80px_80px_40px] items-center gap-3 border-b border-charcoal px-4 py-2 last:border-0"
                          >
                            <span className="truncate text-sm">{item.foodName}</span>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={item.pieces}
                              onChange={(e) =>
                                updateIngredientPieces(idx, Math.max(1, Number(e.target.value) || 1))
                              }
                              className="w-full rounded-sm border border-border bg-dark2 px-2 py-1 text-center text-sm text-text outline-none focus:border-gold/40"
                            />
                            <span className="truncate text-xs text-text3" title={item.servingLabel}>
                              {item.servingLabel}
                            </span>
                            <span className="text-sm text-text2">
                              {Math.round(grams)}g
                            </span>
                            <span className="text-sm text-text2">
                              {Math.round(item.nutrientValuePer100Grams.kcal * ratio)}
                            </span>
                            <span className="text-sm text-text2">
                              {Math.round(item.nutrientValuePer100Grams.protein * ratio)}g
                            </span>
                            <span className="text-sm text-text2">
                              {Math.round(item.nutrientValuePer100Grams.carbs * ratio)}g
                            </span>
                            <span className="text-sm text-text2">
                              {Math.round(item.nutrientValuePer100Grams.fat * ratio)}g
                            </span>
                            <button
                              type="button"
                              onClick={() => removeIngredient(idx)}
                              className="rounded-sm p-1 text-text3 transition-colors hover:text-red"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}

                      {/* Totals row */}
                      <div className="grid grid-cols-[1fr_70px_140px_70px_80px_80px_80px_80px_40px] items-center gap-3 border-t border-border bg-dark2 px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-text3">Total</span>
                        <span />
                        <span />
                        <span />
                        <span className="text-sm font-semibold text-gold">{Math.round(totals.kcal)}</span>
                        <span className="text-sm font-semibold text-text">{Math.round(totals.protein)}g</span>
                        <span className="text-sm font-semibold text-text">{Math.round(totals.carbs)}g</span>
                        <span className="text-sm font-semibold text-text">{Math.round(totals.fat)}g</span>
                        <span />
                      </div>
                    </div>
                  )}

                  {/* Description — rich text editor */}
                  <div>
                    <label className="mb-1 block font-heading text-xs text-text3">
                      {t('recipes.description')}
                    </label>
                    <TiptapEditor
                      content={description}
                      onChange={setDescription}
                      placeholder={t('recipes.descriptionPlaceholder')}
                    />
                  </div>

                </form>
              )}
            </div>

            {/* Sticky save footer */}
            {!loadingDetail && (
              <div className="shrink-0 border-t border-border bg-bg px-6 py-4">
                <button
                  type="submit"
                  form="recipe-form"
                  disabled={saving || !name.trim() || ingredients.length === 0}
                  className="w-full rounded-sm bg-gold px-5 py-3 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
                >
                  {saving ? t('nutrition.saving') : t('common.save')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-sm border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-sm font-bold">{t('recipes.deleteConfirmTitle')}</h3>
            <p className="mt-2 text-sm text-text2">
              {t('recipes.deleteConfirmMessage', { name: confirmDelete.name })}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-sm border border-border px-4 py-2 text-xs font-semibold text-text3 transition-colors hover:text-text"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-sm bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
              >
                {t('recipes.deleteRecipe')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
