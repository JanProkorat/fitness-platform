import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type SheetOption<Value extends string> = { value: Value; label: string };

type OptionSheetProps<Value extends string> = {
  visible: boolean;
  title: string;
  options: SheetOption<Value>[];
  selected: Value;
  onSelect: (value: Value) => void;
  onClose: () => void;
};

/** Bottom sheet that lists the choices for one setting and marks the current one. */
export function OptionSheet<Value extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps<Value>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel={t('settings.sheet.close')}
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        <View accessibilityViewIsModal accessibilityLabel={title} style={styles.sheet}>
          <View style={styles.handle} />
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(option.value)}
                style={styles.option}
              >
                <Text variant="body" style={styles.optionLabel}>
                  {option.label}
                </Text>
                {isSelected ? (
                  <SymbolView
                    name="checkmark"
                    weight="semibold"
                    tintColor={theme.colors.accent}
                    size={theme.sizes.listChevron}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.glass.sheet.backdrop[theme.scheme],
    },
    sheet: {
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      borderTopLeftRadius: theme.glass.sheet.radius,
      borderTopRightRadius: theme.glass.sheet.radius,
      backgroundColor: theme.colors.surface,
    },
    handle: {
      alignSelf: 'center',
      width: theme.glass.sheet.handleWidth,
      height: theme.glass.sheet.handleHeight,
      marginBottom: theme.spacing.xs,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.lineStrong,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: theme.sizes.tabItem,
      paddingVertical: theme.spacing.md,
    },
    optionLabel: {
      flex: 1,
    },
  });
