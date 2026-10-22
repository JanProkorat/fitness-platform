import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import { SheetFrame } from '@/components/profile/edit/SheetFrame';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type ChoiceOption<T extends string | number> = {
  value: T;
  title: string;
  hint?: string;
};

type ChoiceSheetProps<T extends string | number> = {
  visible: boolean;
  title: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  /** Called with the picked value; the sheet closes itself afterwards. */
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Bottom sheet that lists the answers of one question; picking one applies it and closes. */
export function ChoiceSheet<T extends string | number>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: ChoiceSheetProps<T>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { height } = useWindowDimensions();

  return (
    <SheetFrame
      visible={visible}
      title={title}
      onClose={onClose}
      action={
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.spacing.xs}
          onPress={onClose}
          style={styles.cancel}
        >
          <Text variant="body" color="muted">
            {t('editProfile.cancel')}
          </Text>
        </Pressable>
      }
    >
      <ScrollView
        accessibilityRole="radiogroup"
        style={{ maxHeight: height * 0.6 }}
        contentContainerStyle={styles.options}
      >
        {options.map((option) => (
          <View key={String(option.value)} style={styles.optionRow}>
            <ChoiceCard
              title={option.title}
              hint={option.hint}
              selected={option.value === value}
              indicator
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            />
          </View>
        ))}
      </ScrollView>
    </SheetFrame>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    cancel: {
      paddingHorizontal: theme.spacing.xxs,
    },
    options: {
      gap: theme.spacing.xs,
    },
    optionRow: {
      flexDirection: 'row',
    },
  });
