import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { coachInitials } from '@/api/professionals';
import { GlassButton } from '@/components/profile/GlassButton';
import { Text } from '@/components/Text';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type TodayHeaderProps = {
  title: string;
};

/** Greeting and the notifications bell at the top of the Today tab. */
export function TodayHeader({ title }: TodayHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const unread = useUnreadCount();
  const { data: profile } = useProfile();
  const initials = coachInitials({ firstName: profile?.firstName, lastName: profile?.lastName });

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.actions}>
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
        <GlassButton label={t('today.profile')} onPress={() => router.push('/profile')}>
          {initials ? (
            <Text variant="labelStrong">{initials}</Text>
          ) : (
            <SymbolView name="person" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
          )}
        </GlassButton>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.xl,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
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
