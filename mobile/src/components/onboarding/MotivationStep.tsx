import { StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { MOTIVATIONS, PLAN_EXPERIENCES } from '@/api/onboarding';
import type { Motivation } from '@/api/onboarding';
import { ChipInput } from '@/components/onboarding/ChipInput';
import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import type { ChoiceTone } from '@/components/onboarding/ChoiceCard';
import { Segmented } from '@/components/onboarding/Segmented';
import { StepBody, StepGroup } from '@/components/onboarding/StepBody';
import type { StepProps } from '@/components/onboarding/stepProps';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const MOTIVATION_LOOKS: Record<Motivation, { symbol: SFSymbol; tone: ChoiceTone }> = {
  Appearance: { symbol: 'lightbulb', tone: 'training' },
  Health: { symbol: 'heart', tone: 'accent' },
  Performance: { symbol: 'chart.line.uptrend.xyaxis', tone: 'info' },
  Confidence: { symbol: 'star', tone: 'nutrition' },
};

const GRID_COLUMNS = 2;

export function MotivationStep({ form, openSheet }: StepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { answers, set, setList } = form;

  const rows = MOTIVATIONS.reduce<Motivation[][]>((grid, motivation, index) => {
    if (index % GRID_COLUMNS === 0) grid.push([]);
    grid[grid.length - 1].push(motivation);
    return grid;
  }, []);

  const removeFrom = (key: 'blockers' | 'habits', index: number) =>
    setList(
      key,
      answers.lists[key].filter((_, at) => at !== index),
    );

  return (
    <StepBody>
      <StepGroup>
        <Text variant="body" color="muted">
          {t('onboarding.motivation.label')}
        </Text>
        <View accessibilityRole="radiogroup" style={styles.grid}>
          {rows.map((row) => (
            <View key={row.join()} style={styles.gridRow}>
              {row.map((motivation) => (
                <ChoiceCard
                  key={motivation}
                  title={t(`onboarding.motivation.options.${motivation}`)}
                  symbol={MOTIVATION_LOOKS[motivation].symbol}
                  tone={MOTIVATION_LOOKS[motivation].tone}
                  selected={answers.motivation === motivation}
                  onPress={() => set('motivation', motivation)}
                />
              ))}
            </View>
          ))}
        </View>
      </StepGroup>
      <StepGroup>
        <Text variant="body" color="muted">
          {t('onboarding.motivation.experienceLabel')}
        </Text>
        <Segmented
          accessibilityLabel={t('onboarding.motivation.experienceLabel')}
          value={answers.planExperience}
          onChange={(value) => set('planExperience', value)}
          options={PLAN_EXPERIENCES.map((value) => ({
            value,
            label: t(`onboarding.motivation.experience.${value}`),
          }))}
        />
      </StepGroup>
      <ChipInput
        label={t('onboarding.chips.blockers.label')}
        addLabel={t('onboarding.chips.blockers.add')}
        items={answers.lists.blockers}
        onRemove={(index) => removeFrom('blockers', index)}
        onAdd={() => openSheet('blockers')}
      />
      <ChipInput
        label={t('onboarding.chips.habits.label')}
        addLabel={t('onboarding.chips.habits.add')}
        items={answers.lists.habits}
        onRemove={(index) => removeFrom('habits', index)}
        onAdd={() => openSheet('habits')}
      />
    </StepBody>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      gap: theme.spacing.xs,
    },
    gridRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
  });
