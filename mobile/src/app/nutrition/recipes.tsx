import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorStatus } from '@/api/errors';
import { RecipeCard } from '@/components/nutrition/recipes/RecipeCard';
import { RecipeChips } from '@/components/nutrition/recipes/RecipeChips';
import { RecipeGroupHeader } from '@/components/nutrition/recipes/RecipeGroupHeader';
import { RecipeSearchField } from '@/components/nutrition/recipes/RecipeSearchField';
import { RecipesState } from '@/components/nutrition/recipes/RecipesState';
import { filterRecipes, groupByPlan, toRows } from '@/components/nutrition/recipes/model';
import type { RecipeChip, RecipeRow } from '@/components/nutrition/recipes/model';
import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useClientRecipes } from '@/hooks/useClientRecipes';
import { useFullNutritionPlan } from '@/hooks/useFullNutritionPlan';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipeView = 'plan' | 'all';

/** Recipes of the current plan, or of all the client's plans grouped by plan. `?view=all` opens the latter. */
export default function NutritionRecipesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();

  const linkedView: RecipeView = params.view === 'all' ? 'all' : 'plan';
  const [view, setView] = useState<RecipeView>(linkedView);
  const [seenLink, setSeenLink] = useState<RecipeView>(linkedView);
  const [chip, setChip] = useState<RecipeChip>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  // A new deep link (?view=) wins over the segment the user last picked.
  if (seenLink !== linkedView) {
    setSeenLink(linkedView);
    setView(linkedView);
  }

  const plan = useFullNutritionPlan();
  const planId = plan.data?.planId;
  const planScope = view === 'plan';
  const recipes = useClientRecipes(planScope ? planId : undefined, planScope ? Boolean(planId) : true);

  const items = useMemo(() => recipes.data?.items ?? [], [recipes.data]);
  const filtered = useMemo(
    () => filterRecipes(items, chip, searchOpen ? query : ''),
    [items, chip, query, searchOpen],
  );
  const rows = useMemo(() => toRows(filtered, !planScope), [filtered, planScope]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toggleSearch = () => {
    if (searchOpen) setQuery('');
    setSearchOpen((open) => !open);
  };
  const openRecipe = (recipeId: string | undefined) => {
    if (!recipeId) return;
    router.push({ pathname: '/nutrition/recipe/[recipeId]', params: { recipeId } });
  };

  const options: readonly SegmentOption<RecipeView>[] = [
    { value: 'plan', label: t('nutritionRecipes.view.plan') },
    { value: 'all', label: t('nutritionRecipes.view.all') },
  ];

  const noPlan = (
    <RecipesState
      kind="message"
      title={t('nutritionRecipes.noPlan.title')}
      body={t('nutritionRecipes.noPlan.body')}
      actionLabel={t('nutritionRecipes.noPlan.action')}
      onAction={() => setView('all')}
    />
  );

  const body = (() => {
    if (planScope && plan.isPending) return <RecipesState kind="pending" />;
    if (planScope && (plan.isError || !plan.data)) {
      if (getErrorStatus(plan.error) === 404) return noPlan;
      return (
        <RecipesState
          kind="message"
          title={t('nutritionRecipes.error.title')}
          body={t('nutritionRecipes.error.body')}
          actionLabel={t('nutritionRecipes.retry')}
          onAction={() => void plan.refetch()}
        />
      );
    }
    if (recipes.isPending) return <RecipesState kind="pending" />;
    if (recipes.isError) {
      if (planScope && getErrorStatus(recipes.error) === 404) return noPlan;
      return (
        <RecipesState
          kind="message"
          title={t('nutritionRecipes.error.title')}
          body={t('nutritionRecipes.error.body')}
          actionLabel={t('nutritionRecipes.retry')}
          onAction={() => void recipes.refetch()}
        />
      );
    }
    if (items.length === 0) {
      return (
        <RecipesState
          kind="message"
          title={t('nutritionRecipes.empty.title')}
          body={t('nutritionRecipes.empty.body')}
        />
      );
    }
    return null;
  })();

  const summary = planScope
    ? t('nutritionRecipes.summaryPlan', {
        recipes: t('nutritionRecipes.recipes', { count: filtered.length }),
        plan: plan.data?.planName ?? '',
        week: filtered.filter((item) => item.isThisWeek).length,
      })
    : t('nutritionRecipes.summaryAll', {
        recipes: t('nutritionRecipes.recipes', { count: filtered.length }),
        plans: t('nutritionRecipes.plans', { count: groupByPlan(filtered).length }),
      });

  const renderRow = ({ item }: { item: RecipeRow }) => {
    if (item.type === 'header') return <RecipeGroupHeader group={item.group} />;
    const [first, second] = item.items;
    return (
      <View style={styles.pair}>
        <RecipeCard recipe={first} showThisWeek={planScope} onPress={() => openRecipe(first.recipeId)} />
        {second ? (
          <RecipeCard recipe={second} showThisWeek={planScope} onPress={() => openRecipe(second.recipeId)} />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    );
  };

  return (
    <Screen gutter={theme.spacing.xl} topGap={theme.spacing.safeAreaGap} contentStyle={styles.content}>
      <ScreenHeader title={t('nutritionRecipes.title')} backLabel={t('nutritionRecipes.back')} onBack={goBack} />
      <Segmented
        options={options}
        value={view}
        onChange={setView}
        accessibilityLabel={t('nutritionRecipes.view.label')}
      />
      {body ?? (
        <>
          <RecipeChips value={chip} onChange={setChip} gutter={theme.spacing.xl} />
          {searchOpen ? <RecipeSearchField value={query} onChangeText={setQuery} /> : null}
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            ListHeaderComponent={
              <Text variant="bodySmall" color="muted" style={styles.summary}>
                {summary}
              </Text>
            }
            ListEmptyComponent={
              <RecipesState
                kind="message"
                title={t('nutritionRecipes.noMatch.title')}
                body={t('nutritionRecipes.noMatch.body')}
              />
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? t('nutritionRecipes.search.close') : t('nutritionRecipes.search.open')}
            onPress={toggleSearch}
            style={[styles.fab, { bottom: insets.bottom + theme.spacing.xl }]}
          >
            <SymbolView
              name={searchOpen ? 'xmark' : 'magnifyingglass'}
              tintColor={theme.colors.ink}
              size={theme.sizes.searchFabGlyph}
            />
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.md,
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.sizes.searchFab + theme.spacing.huge * 2,
    },
    summary: {
      paddingHorizontal: theme.spacing.xxs,
    },
    pair: {
      flexDirection: 'row',
      gap: theme.spacing.xl,
    },
    spacer: {
      flex: 1,
    },
    fab: {
      position: 'absolute',
      right: theme.spacing.xl,
      width: theme.sizes.searchFab,
      height: theme.sizes.searchFab,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
  });
