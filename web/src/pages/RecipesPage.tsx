import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe } from '@/api/recipes';
import type { RecipeSummary, RecipeDetail } from '@/api/recipe-types';
import type { FoodSummary } from '@/api/food-types';
import FoodSearch from '@/components/nutrition/FoodSearch';
import NutritionBadge from '@/components/nutrition/NutritionBadge';
import { showApiError, showSuccess } from '@/lib/api-errors';

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
  amountGrams: number;
}

export default function RecipesPage() {
  const { t } = useTranslation();

  // List state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const totalPages = data ? Math.ceil((data.totalCount ?? 0) / (data.pageSize ?? 1)) : 0;

  // Calculate totals from ingredients
  const totals = ingredients.reduce(
    (acc, item) => {
      const ratio = item.amountGrams / 100;
      return {
        kcal: acc.kcal + item.nutrientValuePer100Grams.kcal * ratio,
        protein: acc.protein + item.nutrientValuePer100Grams.protein * ratio,
        carbs: acc.carbs + item.nutrientValuePer100Grams.carbs * ratio,
        fat: acc.fat + item.nutrientValuePer100Grams.fat * ratio,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setIngredients([]);
    setShowFoodSearch(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = async (recipe: RecipeSummary) => {
    try {
      const detail: RecipeDetail = await getRecipe(recipe.recipeId);
      setEditingId(detail.recipeId);
      setName(detail.name);
      setDescription(detail.description);
      setIngredients(
        detail.foods.map((f) => ({
          foodExternalId: f.foodExternalId,
          foodName: f.foodName,
          nutrientValuePer100Grams: {
            kcal: f.nutrientValuePer100Grams.kcal,
            protein: f.nutrientValuePer100Grams.protein,
            carbs: f.nutrientValuePer100Grams.carbs,
            fat: f.nutrientValuePer100Grams.fat,
          },
          amountGrams: f.amountGrams,
        })),
      );
      setShowForm(true);
    } catch (err) {
      showApiError(err, 'recipes.updateError');
    }
  };

  const handleFoodSelect = (food: FoodSummary) => {
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
        amountGrams: 100,
      },
    ]);
    setShowFoodSearch(false);
  };

  const updateIngredientAmount = (index: number, grams: number) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, amountGrams: grams } : item)),
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
        amountGrams: item.amountGrams,
      })),
    };

    try {
      if (editingId) {
        await updateRecipe(editingId, payload);
        showSuccess('recipes.updated');
      } else {
        await createRecipe(payload);
        showSuccess('recipes.created');
      }
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err) {
      showApiError(err, editingId ? 'recipes.updateError' : 'recipes.createError');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recipe: RecipeSummary) => {
    if (!window.confirm(t('recipes.confirmDelete'))) return;
    try {
      await deleteRecipe(recipe.recipeId);
      showSuccess('recipes.deleted');
      refetch();
    } catch (err) {
      showApiError(err, 'recipes.deleteError');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center border-b border-border bg-[#111111] px-6 py-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold">{t('recipes.title')}</h1>
          <p className="text-xs text-muted">{t('recipes.subtitle')}</p>
        </div>
        <button
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
          className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
        >
          {t('recipes.addRecipe')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Create / Edit form */}
        {showForm && (
          <div className="mb-5 rounded-sm border border-gold-dim/30 bg-gold/5 p-5">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
            >
              &larr; {t('recipes.title')}
            </button>
            <div className="mb-3 text-sm font-semibold">
              {editingId ? t('recipes.editRecipe') : t('recipes.addRecipe')}
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {/* Name + Description */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="lbl">{t('recipes.recipeName')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('recipes.recipeNamePlaceholder')}
                    required
                    className="mt-1 w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-gold/40"
                  />
                </div>
              </div>
              <div>
                <label className="lbl">{t('recipes.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('recipes.descriptionPlaceholder')}
                  rows={3}
                  className="mt-1 w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none focus:border-gold/40"
                />
              </div>

              {/* Ingredients section */}
              <div>
                <label className="lbl">{t('recipes.foods')}</label>
                {ingredients.length > 0 && (
                  <div className="mt-2 rounded-sm border border-border bg-surface">
                    {/* Ingredient header */}
                    <div className="grid grid-cols-[1fr_90px_70px_70px_70px_70px_40px] gap-3 border-b border-border px-4 py-2">
                      <span className="lbl">{t('common.name')}</span>
                      <span className="lbl">{t('nutrition.grams')}</span>
                      <span className="lbl">{t('foods.kcal')}</span>
                      <span className="lbl">{t('foods.protein')}</span>
                      <span className="lbl">{t('foods.carbs')}</span>
                      <span className="lbl">{t('foods.fat')}</span>
                      <span />
                    </div>
                    {/* Ingredient rows */}
                    {ingredients.map((item, idx) => {
                      const ratio = item.amountGrams / 100;
                      return (
                        <div
                          key={`${item.foodExternalId}-${idx}`}
                          className="grid grid-cols-[1fr_90px_70px_70px_70px_70px_40px] items-center gap-3 border-b border-charcoal px-4 py-2 last:border-0"
                        >
                          <span className="truncate text-sm">{item.foodName}</span>
                          <input
                            type="number"
                            min={1}
                            value={item.amountGrams}
                            onChange={(e) =>
                              updateIngredientAmount(idx, Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full rounded-sm border border-border bg-dark2 px-2 py-1 text-sm text-text outline-none focus:border-gold/40"
                          />
                          <span className="text-xs text-text2">
                            {Math.round(item.nutrientValuePer100Grams.kcal * ratio)}
                          </span>
                          <span className="text-xs text-text2">
                            {Math.round(item.nutrientValuePer100Grams.protein * ratio)}g
                          </span>
                          <span className="text-xs text-text2">
                            {Math.round(item.nutrientValuePer100Grams.carbs * ratio)}g
                          </span>
                          <span className="text-xs text-text2">
                            {Math.round(item.nutrientValuePer100Grams.fat * ratio)}g
                          </span>
                          <button
                            type="button"
                            onClick={() => removeIngredient(idx)}
                            className="text-xs text-text3 transition-colors hover:text-red-400"
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}

                    {/* Totals row */}
                    <div className="grid grid-cols-[1fr_90px_70px_70px_70px_70px_40px] items-center gap-3 border-t border-border bg-dark2 px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-text3">
                        Total
                      </span>
                      <span />
                      <span className="text-xs font-semibold text-gold">
                        {Math.round(totals.kcal)}
                      </span>
                      <span className="text-xs font-semibold text-text">
                        {Math.round(totals.protein)}g
                      </span>
                      <span className="text-xs font-semibold text-text">
                        {Math.round(totals.carbs)}g
                      </span>
                      <span className="text-xs font-semibold text-text">
                        {Math.round(totals.fat)}g
                      </span>
                      <span />
                    </div>
                  </div>
                )}

                {/* Add ingredient button / search */}
                <div className="mt-2">
                  {showFoodSearch ? (
                    <FoodSearch
                      onSelect={handleFoodSelect}
                      onClose={() => setShowFoodSearch(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFoodSearch(true)}
                      className="font-heading text-[11px] font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
                    >
                      {t('recipes.addFood')}
                    </button>
                  )}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !name.trim() || ingredients.length === 0}
                  className="rounded-sm bg-gold px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
                >
                  {saving ? t('nutrition.saving') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-sm border border-border px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-text"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

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
              <div className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_120px] gap-4 border-b border-border px-5 py-3">
                <span className="lbl">{t('recipes.recipeName')}</span>
                <span className="lbl">{t('recipes.foods')}</span>
                <span className="lbl">{t('foods.kcal')}</span>
                <span className="lbl">{t('foods.protein')}</span>
                <span className="lbl">{t('foods.carbs')}</span>
                <span className="lbl">{t('foods.fat')}</span>
                <span className="lbl text-right">{t('common.actions')}</span>
              </div>

              {/* Rows */}
              {data.recipes.map((recipe) => (
                <div
                  key={recipe.recipeId}
                  className="grid grid-cols-[1fr_100px_80px_80px_80px_80px_120px] items-center gap-4 border-b border-charcoal px-5 py-3 last:border-0"
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
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(recipe)}
                      className="font-heading text-[11px] font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
                    >
                      {t('nutrition.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(recipe)}
                      className="font-heading text-[11px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-red-400"
                    >
                      {t('nutrition.delete')}
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
    </div>
  );
}
