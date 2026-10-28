import { Pressable, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { GlassIconButton } from '@/components/nutrition/meal/GlassIconButton';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type WeekTab = { key: 'this' | 'next'; label: string; disabled: boolean };

type ShoppingHeaderProps = {
  title: string;
  subtitle: string;
  backLabel: string;
  onBack: () => void;
  shareLabel: string;
  /** Without it the share slot stays empty, so the title keeps its centre. */
  onShare?: () => void;
  tabs: WeekTab[];
  selected: WeekTab['key'];
  onSelect: (key: WeekTab['key']) => void;
};

/** Back button, centred title with the week line, share button, and the This week / Next week switch. */
export function ShoppingHeader({
  title,
  subtitle,
  backLabel,
  onBack,
  shareLabel,
  onShare,
  tabs,
  selected,
  onSelect,
}: ShoppingHeaderProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.slotStart}>
          <BackButton label={backLabel} onPress={onBack} />
        </View>
        <View style={styles.titles}>
          <Text variant="headerTitle" accessibilityRole="header" numberOfLines={1} style={styles.centered}>
            {title}
          </Text>
          <Text variant="headerSubtitle" color="muted" numberOfLines={1} style={styles.centered}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.slotEnd}>
          {onShare ? <GlassIconButton symbol="square.and.arrow.up" label={shareLabel} onPress={onShare} /> : null}
        </View>
      </View>

      <View accessibilityRole="tablist" style={styles.segments}>
        {tabs.map((tab) => {
          const active = tab.key === selected;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: tab.disabled }}
              disabled={tab.disabled}
              onPress={() => onSelect(tab.key)}
              style={[styles.segment, active && styles.selected, tab.disabled && styles.disabled]}
            >
              <Text variant={active ? 'labelStrong' : 'label'} color={active ? 'ink' : 'muted'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    slotStart: {
      width: theme.sizes.headerSlot,
      alignItems: 'flex-start',
    },
    slotEnd: {
      width: theme.sizes.headerSlot,
      alignItems: 'flex-end',
    },
    titles: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.hair,
    },
    centered: {
      textAlign: 'center',
    },
    segments: {
      flexDirection: 'row',
      padding: theme.spacing.hair,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.tabSelected,
    },
    segment: {
      flex: 1,
      height: theme.sizes.segment,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
    },
    selected: {
      backgroundColor: theme.colors.segmentSelected,
      boxShadow: theme.shadows.card,
    },
    disabled: {
      opacity: theme.opacity.disabled,
    },
  });
