import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type WeekRowKind = 'group' | 'past' | 'current' | 'future' | 'preparing';

type WeekRowProps = {
  kind: WeekRowKind;
  title: string;
  subtitle: string;
  /** Right-hand figure: progress, or the daily energy of a week still ahead. */
  detail?: string;
  /** A group row shows a down/up chevron, other rows a right chevron; a row without a handler has none. */
  expanded?: boolean;
  first?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** One row of the plan's weeks list. */
export function WeekRow({
  kind,
  title,
  subtitle,
  detail,
  expanded = false,
  first = false,
  onPress,
  accessibilityLabel,
}: WeekRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const isCurrent = kind === 'current';
  const muted = kind === 'group' || kind === 'past' || kind === 'preparing';
  const chevron = kind === 'group' ? (expanded ? 'chevron.up' : 'chevron.down') : 'chevron.right';

  const content = (
    <>
      <Marker kind={kind} />
      <View style={styles.copy}>
        <Text variant={isCurrent ? 'bodyStrong' : 'body'} color={muted ? 'muted' : 'ink'} style={styles.title}>
          {title}
        </Text>
        <Text variant="caption" color="muted">
          {subtitle}
        </Text>
      </View>
      {detail ? (
        <Text variant={isCurrent ? 'labelStrong' : 'label'} color={isCurrent ? 'nutritionInk' : 'muted'}>
          {detail}
        </Text>
      ) : null}
      {onPress ? (
        <SymbolView name={chevron} weight="medium" tintColor={theme.colors.muted} size={theme.sizes.listChevron} />
      ) : null}
    </>
  );

  const rowStyle = [styles.row, !first && !isCurrent && styles.divider, isCurrent && styles.current];
  if (!onPress) {
    return (
      <View accessible style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={kind === 'group' ? { expanded } : undefined}
      accessibilityLabel={accessibilityLabel ?? `${title}, ${subtitle}`}
      onPress={onPress}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}

function Marker({ kind }: { kind: WeekRowKind }) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (kind === 'current') {
    return (
      <View style={[styles.marker, styles.markerNow]}>
        <View style={styles.markerDot} />
      </View>
    );
  }
  if (kind === 'future') {
    return <View style={[styles.marker, styles.markerAhead]} />;
  }
  return (
    <View style={[styles.marker, styles.markerPast]}>
      <SymbolView
        name={kind === 'preparing' ? 'clock' : 'checkmark'}
        weight="semibold"
        tintColor={theme.colors.muted}
        size={theme.sizes.mealMissedGlyph}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      minHeight: theme.sizes.mealTouch,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    current: {
      marginHorizontal: -theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.field,
      backgroundColor: theme.colors.nutritionSoft,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    title: {
      flexShrink: 1,
    },
    marker: {
      width: theme.sizes.weekMarker,
      height: theme.sizes.weekMarker,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerPast: {
      backgroundColor: theme.colors.tabSelected,
    },
    markerNow: {
      borderWidth: theme.sizes.weekMarkerNowBorder,
      borderColor: theme.colors.nutrition,
    },
    markerDot: {
      width: theme.sizes.weekMarkerDot,
      height: theme.sizes.weekMarkerDot,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.nutrition,
    },
    markerAhead: {
      borderWidth: theme.sizes.border,
      borderStyle: 'dashed',
      borderColor: theme.colors.muted,
    },
  });
