import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getErrorStatus } from '@/api/errors';
import type { FullPlanWeek, GetFullPlanResponse } from '@/api/generated';
import { Button } from '@/components/Button';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import { formatShortDate, isoDay, localToday, weekPhase } from '@/components/nutrition/plan/model';
import { boughtCount, buildShareText, groupByCategory, quantityOf, tickableItems } from '@/components/nutrition/shopping/model';
import { ShoppingHeader } from '@/components/nutrition/shopping/ShoppingHeader';
import type { WeekTab } from '@/components/nutrition/shopping/ShoppingHeader';
import { ShoppingSectionCard } from '@/components/nutrition/shopping/ShoppingSectionCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useFullNutritionPlan } from '@/hooks/useFullNutritionPlan';
import { useShoppingList } from '@/hooks/useShoppingList';
import { useToggleShoppingItem } from '@/hooks/useToggleShoppingItem';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NumberedWeek = FullPlanWeek & { weekNumber: number };

const hasNumber = (week: FullPlanWeek): week is NumberedWeek => typeof week.weekNumber === 'number';

/** This week (week 1 while the plan has not started) and the published week after it, if any. */
function pickWeeks(plan: GetFullPlanResponse): { current: NumberedWeek; next: NumberedWeek | undefined } | null {
  const today = localToday();
  const weeks = (plan.weeks ?? []).filter(hasNumber).sort((first, second) => first.weekNumber - second.weekNumber);
  const current =
    weeks.find((week) => weekPhase(week, today) === 'current') ?? weeks.find((week) => weekPhase(week, today) === 'future');
  if (!current) return null;
  return { current, next: weeks.find((week) => week.weekNumber === current.weekNumber + 1) };
}

/** The shopping list of this week or next week of the plan, with items to tick off. */
export default function ShoppingListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = useFullNutritionPlan();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (plan.isPending) {
    return <PlanState kind="pending" onBack={goBack} />;
  }
  if (plan.isError || !plan.data) {
    const missing = getErrorStatus(plan.error) === 404;
    return (
      <PlanState
        kind={missing ? 'empty' : 'error'}
        title={missing ? t('nutritionShoppingList.empty.noPlanTitle') : t('nutritionShoppingList.error.title')}
        body={missing ? t('nutritionShoppingList.empty.noPlanBody') : t('nutritionShoppingList.error.body')}
        onBack={goBack}
        onRetry={() => void plan.refetch()}
      />
    );
  }
  const weeks = pickWeeks(plan.data);
  if (!weeks) {
    return (
      <PlanState
        kind="empty"
        title={t('nutritionShoppingList.empty.noWeekTitle')}
        body={t('nutritionShoppingList.empty.noWeekBody')}
        onBack={goBack}
      />
    );
  }
  return <ShoppingListContent current={weeks.current} next={weeks.next} onBack={goBack} />;
}

type ShoppingListContentProps = { current: NumberedWeek; next: NumberedWeek | undefined; onBack: () => void };

function ShoppingListContent({ current, next, onBack }: ShoppingListContentProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const [tab, setTab] = useState<WeekTab['key']>('this');

  const week = tab === 'next' && next ? next : current;
  const list = useShoppingList(week.weekNumber);
  const toggle = useToggleShoppingItem(week.weekNumber);

  const items = tickableItems(list.data);
  const sections = groupByCategory(items, language);
  const date = formatShortDate(language, isoDay(week.weekStartDate));
  const subtitle =
    items.length > 0
      ? t('nutritionShoppingList.subtitle', { date, done: boughtCount(items), total: items.length })
      : t('nutritionShoppingList.subtitleEmpty', { date });

  const quantityLabel = (item: (typeof items)[number]): string => {
    const quantity = quantityOf(language, item.totalAmountGrams);
    return quantity.unit === 'kg'
      ? t('nutritionShoppingList.kilograms', { value: quantity.value })
      : t('nutritionShoppingList.grams', { value: quantity.value });
  };
  const categoryLabel = (category: string) => t(`nutritionShoppingList.categories.${category}`);

  const share = () => {
    const message = buildShareText({
      title: t('nutritionShoppingList.title'),
      subtitle,
      sections,
      categoryLabel,
      quantityLabel,
      language,
    });
    void Share.share({ message });
  };

  const tabs: WeekTab[] = [
    { key: 'this', label: t('nutritionShoppingList.thisWeek'), disabled: false },
    { key: 'next', label: t('nutritionShoppingList.nextWeek'), disabled: next === undefined },
  ];

  const missing = list.isError && getErrorStatus(list.error) === 404;

  return (
    <Screen
      scroll
      gutter={theme.spacing.xl}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={theme.spacing.huge}
      contentStyle={styles.content}
      header={
        <ShoppingHeader
          title={t('nutritionShoppingList.title')}
          subtitle={subtitle}
          backLabel={t('onboarding.back')}
          onBack={onBack}
          shareLabel={t('nutritionShoppingList.share')}
          onShare={items.length > 0 ? share : undefined}
          tabs={tabs}
          selected={tab === 'next' && next ? 'next' : 'this'}
          onSelect={setTab}
        />
      }
    >
      {toggle.isError ? (
        <Text variant="label" color="error" accessibilityRole="alert">
          {t('nutritionShoppingList.tickError')}
        </Text>
      ) : null}

      {list.isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : list.isError ? (
        <View style={styles.state}>
          <Text variant="body" color="muted" style={styles.centered}>
            {missing ? t('nutritionShoppingList.empty.noPlanBody') : t('nutritionShoppingList.error.body')}
          </Text>
          {missing ? null : <Button label={t('nutritionShoppingList.retry')} onPress={() => void list.refetch()} />}
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.state}>
          <Text variant="heading" accessibilityRole="header" style={styles.centered}>
            {t('nutritionShoppingList.empty.weekTitle')}
          </Text>
          <Text variant="body" color="muted" style={styles.centered}>
            {t('nutritionShoppingList.empty.weekBody')}
          </Text>
        </View>
      ) : (
        sections.map((section) => (
          <ShoppingSectionCard
            key={section.category}
            heading={categoryLabel(section.category)}
            items={section.items}
            language={language}
            quantityLabel={quantityLabel}
            onToggle={(foodExternalId, isTicked) => toggle.mutate({ foodExternalId, isTicked })}
          />
        ))
      )}
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
    },
    state: {
      gap: theme.spacing.xl,
      paddingVertical: theme.spacing.huge,
    },
    centered: {
      textAlign: 'center',
    },
  });
