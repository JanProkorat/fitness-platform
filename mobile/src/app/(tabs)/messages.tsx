import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { Conversation } from '@/api/conversations';
import { ConversationRow } from '@/components/messages/ConversationRow';
import { PlanState } from '@/components/nutrition/plan/PlanState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { TabFade } from '@/components/TabFade';
import { Text } from '@/components/Text';
import { useConversations } from '@/hooks/useConversations';
import { isOfflineEmpty, showsError } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const byRecency = (a: Conversation, b: Conversation) =>
  Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? '') || 0;

export default function MessagesScreen() {
  return (
    <TabFade>
      <MessagesContent />
    </TabFade>
  );
}

function MessagesContent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const conversations = useConversations();
  const { data, isPending, refetch } = conversations;
  const barClearance = theme.sizes.tabBar + theme.sizes.tabBarBottom + theme.spacing.xxl;

  const rows = (data ?? []).filter((conversation) => conversation.id);
  const active = rows.filter((conversation) => !conversation.isFormer).sort(byRecency);
  const former = rows.filter((conversation) => conversation.isFormer).sort(byRecency);

  const open = (conversation: Conversation) => {
    if (conversation.id) router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
  };

  const renderGroup = (group: Conversation[]) => (
    <View style={styles.card}>
      {group.map((conversation, index) => (
        <View key={conversation.id} style={index > 0 && styles.divider}>
          <ConversationRow conversation={conversation} onPress={() => open(conversation)} />
        </View>
      ))}
    </View>
  );

  if (isOfflineEmpty(conversations)) {
    return <PlanState kind="offline" />;
  }

  return (
    <Screen
      scroll
      collapseTabBar
      topGap={theme.spacing.safeAreaGap}
      bottomInset={barClearance}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text variant="title" accessibilityRole="header">
            {t('tabs.messages')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('messages.compose')}
          onPress={() => router.push('/coach-search')}
          style={styles.compose}
        >
          <SymbolView name="square.and.pencil" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
        </Pressable>
      </View>

      <OfflineBanner />

      {isPending ? (
        <ActivityIndicator color={theme.colors.accent} style={styles.status} />
      ) : showsError(conversations) ? (
        <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.status}>
          <Text variant="bodyLarge" color="muted">
            {t('messages.error')}
          </Text>
        </Pressable>
      ) : rows.length === 0 ? (
        <View style={styles.status}>
          <Text variant="subtitle">{t('messages.empty.title')}</Text>
          <Text variant="bodyLarge" color="muted">
            {t('messages.empty.body')}
          </Text>
        </View>
      ) : (
        <>
          {active.length > 0 ? renderGroup(active) : null}
          {former.length > 0 ? (
            <>
              <Text variant="overline" color="muted" style={styles.overline}>
                {t('messages.pastCoaches').toUpperCase()}
              </Text>
              {renderGroup(former)}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.xl,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    compose: {
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
    card: {
      padding: theme.spacing.xs,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    status: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.huge,
      alignItems: 'center',
    },
  });
