import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type TodayHeaderProps = {
  eyebrow: string;
  title: string;
};

/** Eyebrow, greeting and the notifications bell at the top of the Today tab. */
export function TodayHeader({ eyebrow, title }: TodayHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const unread = useUnreadCount();

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="bodyLarge" color="muted">
          {eyebrow}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0
            ? t('today.notificationsUnread', { count: unread })
            : t('today.notifications')
        }
        onPress={() => router.push('/notifications')}
        style={styles.bell}
      >
        <SymbolView name="bell" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
        {unread > 0 ? <View style={styles.dot} /> : null}
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.xl,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    bell: {
      width: theme.sizes.bellButton,
      height: theme.sizes.bellButton,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    dot: {
      position: 'absolute',
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      width: theme.sizes.bellDot,
      height: theme.sizes.bellDot,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accent,
    },
  });
