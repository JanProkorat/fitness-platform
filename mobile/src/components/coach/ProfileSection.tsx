import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ProfileSectionProps = {
  label: string;
  /** Small hint at the right edge of the label row. */
  note?: string;
  children: ReactNode;
};

/** A labelled block on a coach profile. */
export function ProfileSection({ label, note, children }: ProfileSectionProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="overline" color="muted" style={styles.overline}>
          {label.toUpperCase()}
        </Text>
        {note ? (
          <Text variant="caption" color="muted">
            {note}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** The rounded card that holds a profile section's rows. */
export function ProfileCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return <View style={styles.card}>{children}</View>;
}

type ProfileRowProps = {
  symbol: SFSymbol;
  title: string;
  subtitle?: string;
  /** Row is a link: shows a chevron when `chevron` and responds to taps. */
  onPress?: () => void;
  chevron?: boolean;
  /** First row in a card has no divider. */
  first?: boolean;
};

/** An icon, a title and an optional second line; tappable when `onPress` is given. */
export function ProfileRow({ symbol, title, subtitle, onPress, chevron = false, first = false }: ProfileRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const body = (
    <>
      <View style={styles.icon}>
        <SymbolView name={symbol} tintColor={theme.colors.ink2} size={theme.sizes.listGlyph} />
      </View>
      <View style={styles.copy}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {chevron ? (
        <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
      ) : null}
    </>
  );
  const rowStyle = [styles.row, !first && styles.divider];

  if (!onPress) {
    return <View style={rowStyle}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.snug,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    overline: {
      paddingHorizontal: theme.spacing.xxs,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    card: {
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    pressed: {
      opacity: 0.7,
    },
    icon: {
      width: theme.sizes.listIcon,
      height: theme.sizes.listIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.field,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
  });
