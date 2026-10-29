import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { foodSummaryName, FOOD_SEARCH_MIN_LENGTH } from '@/api/foods';
import { getErrorStatus } from '@/api/errors';
import type { FoodSummary } from '@/api/generated';
import { DAY_LOG_VERSION_CONFLICT, OFF_PLAN_MAX_GRAMS, getTopLevelErrorCode } from '@/api/nutrition';
import { Button } from '@/components/Button';
import { formatAmount, formatWhole, macrosOf, scaleMacros } from '@/components/nutrition/meal/format';
import { SheetFrame } from '@/components/profile/edit/SheetFrame';
import { Text } from '@/components/Text';
import { useAddOffPlanFood } from '@/hooks/useOffPlanFood';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import { newClientId } from '@/lib/outbox/id';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

const QUICK_AMOUNTS = [50, 100, 150, 200] as const;
const MACRO_ROWS: { key: 'protein' | 'carbs' | 'fat' | 'fiber'; color: keyof Colors }[] = [
  { key: 'protein', color: 'macroProtein' },
  { key: 'carbs', color: 'macroCarbs' },
  { key: 'fat', color: 'macroFat' },
  { key: 'fiber', color: 'macroFiber' },
];

type OffPlanSheetProps = { visible: boolean; onClose: () => void };

/** Bottom sheet that logs a food eaten outside the plan: search, then an amount in grams. */
export function OffPlanSheet({ visible, onClose }: OffPlanSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [term, setTerm] = useState('');
  const [food, setFood] = useState<FoodSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [failure, setFailure] = useState<'conflict' | 'missing' | 'generic' | null>(null);
  const add = useAddOffPlanFood();

  const close = () => {
    setTerm('');
    setFood(null);
    setAmount('');
    setFailure(null);
    add.reset();
    onClose();
  };

  const closeButton = (
    <Pressable accessibilityRole="button" accessibilityLabel={t('nutritionTab.sheet.close')} onPress={close} style={styles.round}>
      <SymbolView name="xmark" weight="medium" tintColor={theme.colors.ink} size={theme.sizes.sheetCloseGlyph} />
    </Pressable>
  );

  return (
    <SheetFrame
      visible={visible}
      title={food ? '' : t('nutritionTab.sheet.title')}
      action={closeButton}
      onClose={close}
    >
      {food ? (
        <AmountStep
          food={food}
          amount={amount}
          failure={failure}
          busy={add.isPending}
          onAmount={(value) => {
            setAmount(value);
            setFailure(null);
          }}
          onBack={() => {
            setFood(null);
            setFailure(null);
          }}
          onSubmit={(grams) => {
            setFailure(null);
            add.mutate(
              { entryId: newClientId(), food, amountGrams: grams },
              {
                onSuccess: close,
                onError: (error) => {
                  if (getTopLevelErrorCode(error) === DAY_LOG_VERSION_CONFLICT || getErrorStatus(error) === 409) {
                    setFailure('conflict');
                  } else if (getErrorStatus(error) === 404) {
                    setFailure('missing');
                  } else {
                    setFailure('generic');
                  }
                },
              },
            );
          }}
        />
      ) : (
        <SearchStep
          term={term}
          onTerm={setTerm}
          onPick={(picked) => {
            setFood(picked);
            setAmount('');
          }}
        />
      )}
    </SheetFrame>
  );
}

type SearchStepProps = { term: string; onTerm: (value: string) => void; onPick: (food: FoodSummary) => void };

function SearchStep({ term, onTerm, onPick }: SearchStepProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { query, active } = useFoodSearch(term);
  const foods = (query.data?.foods ?? []).filter((item) => Boolean(item.foodId));

  return (
    <View style={styles.step}>
      <Text variant="bodySmall" color="muted">
        {t('nutritionTab.sheet.subtitle')}
      </Text>
      <View style={styles.field}>
        <SymbolView name="magnifyingglass" tintColor={theme.colors.muted} size={theme.sizes.fieldIcon} />
        <TextInput
          autoFocus
          value={term}
          onChangeText={onTerm}
          accessibilityLabel={t('nutritionTab.sheet.searchLabel')}
          placeholder={t('nutritionTab.sheet.searchPlaceholder')}
          placeholderTextColor={theme.colors.muted}
          selectionColor={theme.colors.accent}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.fieldText}
        />
        {term.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nutritionTab.sheet.clear')}
            hitSlop={theme.spacing.xs}
            onPress={() => onTerm('')}
          >
            <SymbolView name="xmark.circle.fill" tintColor={theme.colors.muted} size={theme.sizes.fieldIcon} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.results}>
        {term.trim().length < FOOD_SEARCH_MIN_LENGTH ? (
          <Text variant="bodySmall" color="muted">
            {t('nutritionTab.sheet.hint', { min: FOOD_SEARCH_MIN_LENGTH })}
          </Text>
        ) : !active || query.isPending ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : query.isError ? (
          <View style={styles.errorRow}>
            <Text variant="bodySmall" color="muted" style={styles.grow}>
              {t('nutritionTab.sheet.searchError')}
            </Text>
            <Text variant="link" color="nutritionInk" accessibilityRole="button" onPress={() => void query.refetch()}>
              {t('nutritionTab.retry')}
            </Text>
          </View>
        ) : foods.length === 0 ? (
          <Text variant="bodySmall" color="muted">
            {t('nutritionTab.sheet.noResults')}
          </Text>
        ) : (
          <>
            <Text variant="bodySmall" color="muted">
              {t('nutritionTab.sheet.results', { count: foods.length })}
            </Text>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {foods.map((item, index) => (
                <Pressable
                  key={item.foodId}
                  accessibilityRole="button"
                  onPress={() => onPick(item)}
                  style={[styles.result, index > 0 && styles.resultDivider]}
                >
                  <View style={styles.grow}>
                    <Text variant="body" numberOfLines={2}>
                      {foodSummaryName(item, i18n.language)}
                    </Text>
                    <Text variant="bodySmall" color="muted">
                      {t('nutritionTab.sheet.per100', { value: formatWhole(i18n.language, item.nutrientValue?.kcal ?? 0) })}
                    </Text>
                  </View>
                  <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.mealItemChevron} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

type AmountStepProps = {
  food: FoodSummary;
  amount: string;
  failure: 'conflict' | 'missing' | 'generic' | null;
  busy: boolean;
  onAmount: (value: string) => void;
  onBack: () => void;
  onSubmit: (grams: number) => void;
};

function AmountStep({ food, amount, failure, busy, onAmount, onBack, onSubmit }: AmountStepProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;
  const grams = Number(amount.replace(',', '.'));
  const valid = amount.trim() !== '' && Number.isFinite(grams) && grams > 0 && grams <= OFF_PLAN_MAX_GRAMS;
  const per100 = macrosOf(food.nutrientValue);
  const eaten = scaleMacros(per100, (valid ? grams : 0) / 100);

  return (
    <View style={styles.step}>
      <View style={styles.amountHead}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('nutritionTab.sheet.back')} onPress={onBack} style={styles.round}>
          <SymbolView name="chevron.left" weight="medium" tintColor={theme.colors.ink} size={theme.sizes.sheetCloseGlyph} />
        </Pressable>
        <View style={styles.grow}>
          <Text variant="heading" numberOfLines={2} accessibilityRole="header">
            {foodSummaryName(food, language)}
          </Text>
          <Text variant="bodySmall" color="muted">
            {t('nutritionTab.sheet.per100', { value: formatWhole(language, per100.kcal) })}
          </Text>
        </View>
      </View>

      <View style={styles.amountBlock}>
        <Text variant="bodySmall" color="muted">
          {t('nutritionTab.sheet.amount')}
        </Text>
        <View style={styles.amountField}>
          <TextInput
            autoFocus
            value={amount}
            onChangeText={(value) => onAmount(value.replace(/[^0-9.,]/g, ''))}
            accessibilityLabel={t('nutritionTab.sheet.amount')}
            keyboardType="decimal-pad"
            selectionColor={theme.colors.accent}
            maxLength={7}
            style={styles.amountText}
          />
          <Text variant="bodyLarge" color="muted">
            {t('nutritionTab.sheet.unit')}
          </Text>
        </View>
        <View style={styles.chips}>
          {QUICK_AMOUNTS.map((quick) => {
            const selected = valid && grams === quick;
            return (
              <Pressable
                key={quick}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onAmount(String(quick))}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text variant="labelStrong" color={selected ? 'onPrimary' : 'ink2'}>
                  {t('nutritionTab.sheet.quick', { value: quick })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.addsRow}>
        <Text variant="bodySmall" color="muted">
          {t('nutritionTab.sheet.addsToToday')}
        </Text>
        <Text variant="barTitle">{t('nutritionTab.sheet.kcal', { value: formatWhole(language, eaten.kcal) })}</Text>
      </View>
      <View style={styles.macros}>
        {MACRO_ROWS.map(({ key, color }, index) => (
          <View key={key} style={[styles.macroRow, index > 0 && styles.resultDivider]}>
            <View style={[styles.dot, { backgroundColor: theme.colors[color] }]} />
            <Text variant="body" color="muted" style={styles.grow}>
              {t(`nutritionMeal.macros.${key}`)}
            </Text>
            <Text variant="bodyStrong">{t('nutritionMeal.macros.grams', { value: formatAmount(language, Math.round(eaten[key] * 10) / 10) })}</Text>
          </View>
        ))}
      </View>

      {failure ? (
        <Text variant="bodySmall" color="error" accessibilityLiveRegion="polite">
          {t(`nutritionTab.sheet.errors.${failure}`)}
        </Text>
      ) : null}
      <Button label={t('nutritionTab.sheet.submit')} disabled={!valid || busy} onPress={() => onSubmit(grams)} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    step: {
      gap: theme.spacing.lg,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
    round: {
      width: theme.sizes.sheetClose,
      height: theme.sizes.sheetClose,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.subtle,
    },
    field: {
      height: theme.sizes.field,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      backgroundColor: theme.colors.field,
    },
    fieldText: {
      ...theme.typography.bodyLarge,
      flex: 1,
      height: '100%',
      padding: 0,
      color: theme.colors.ink,
    },
    results: {
      gap: theme.spacing.sm,
      minHeight: theme.sizes.heroIcon,
    },
    list: {
      maxHeight: theme.sizes.inviteHero + theme.sizes.coachAvatar,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
    },
    result: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    resultDivider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    amountHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    amountBlock: {
      gap: theme.spacing.xs,
    },
    amountField: {
      height: theme.sizes.metricHeroField,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.field,
    },
    amountText: {
      ...theme.typography.display,
      flex: 1,
      height: '100%',
      padding: 0,
      color: theme.colors.ink,
    },
    chips: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    chip: {
      flex: 1,
      height: theme.sizes.buttonMedium,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.field,
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    addsRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    macros: {
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
    },
    macroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    dot: {
      width: theme.sizes.macroDot,
      height: theme.sizes.macroDot,
      borderRadius: theme.radii.pill,
    },
  });
