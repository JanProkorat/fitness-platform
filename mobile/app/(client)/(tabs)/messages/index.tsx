import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useRouter } from 'expo-router'
import { href } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ConversationRow } from '@/components/messages/ConversationRow'
import { AutoUnarchiveBanner } from '@/components/messages/AutoUnarchiveBanner'
import { useMessagesStore } from '@/stores/messagesStore'
import { fetchConversations, archiveConversation } from '@/api/messages'

export default function MessagesScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const autoUnarchivedIds = useMessagesStore((s) => s.autoUnarchivedIds)
  const autoUnarchivedNames = useMessagesStore((s) => s.autoUnarchivedNames)
  const dismissAutoUnarchive = useMessagesStore((s) => s.dismissAutoUnarchive)

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchConversations(false),
    staleTime: 10_000,
  })

  const archiveMutation = useMutation({
    mutationFn: archiveConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['archived-conversations'] })
    },
  })

  const filtered = useMemo(() => {
    if (!conversations) return []
    const list = search.trim()
      ? conversations.filter((c) =>
          (c.participant?.name ?? '').toLowerCase().includes(search.toLowerCase()),
        )
      : conversations

    return [...list].sort((a, b) => {
      const aUnread = a.unreadCount ?? 0
      const bUnread = b.unreadCount ?? 0
      if (aUnread > 0 && bUnread === 0) return -1
      if (aUnread === 0 && bUnread > 0) return 1
      return (
        new Date(b.lastMessageAt ?? '').getTime() -
        new Date(a.lastMessageAt ?? '').getTime()
      )
    })
  }, [conversations, search])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[Type.largeTitle, { color: colors.label }]}>{t('messages.title')}</Text>
          <Pressable style={[styles.composeBtn, { backgroundColor: colors.fill }]}>
            <Ionicons name="create-outline" size={18} color={colors.gold} />
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, { backgroundColor: colors.fill }]}>
            <Ionicons name="search" size={16} color={colors.label3} />
            <TextInput
              style={[styles.searchInput, { color: colors.label }]}
              placeholder={t('messages.search')}
              placeholderTextColor={colors.label3}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Ionicons
                name="close-circle"
                size={16}
                color={colors.label3}
                onPress={() => setSearch('')}
              />
            )}
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.label3} />
            <Text style={[Type.body, { color: colors.label2, marginTop: 12 }]}>
              {search ? t('messages.noConversations') : t('messages.noMessages')}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
            {/* Auto-unarchive banners */}
            {autoUnarchivedIds.map((id) => (
              <AutoUnarchiveBanner
                key={id}
                conversationName={autoUnarchivedNames[id] ?? ''}
                onPress={() => {
                  dismissAutoUnarchive(id)
                  router.push(href(`/(client)/messages/${id}`))
                }}
                onDismiss={() => dismissAutoUnarchive(id)}
              />
            ))}

            {/* Conversations card */}
            <View style={[styles.listCard, { backgroundColor: colors.bg2 }]}>
              {filtered.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && (
                    <View style={{ paddingLeft: 78 }}>
                      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep2 }} />
                    </View>
                  )}
                  <ConversationRow
                    conversation={item}
                    onPress={() => router.push(href(`/(client)/messages/${item.id ?? ''}`))}
                    onArchive={() => archiveMutation.mutate(item.id ?? '')}
                  />
                </React.Fragment>
              ))}
            </View>

            {/* Archived conversations link */}
            <Pressable
              style={styles.archivedLink}
              onPress={() => router.push(href('/(client)/messages/archived'))}
            >
              <Text style={[styles.archivedText, { color: colors.gold }]}>
                {t('messages.archivedConversations')}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
            </Pressable>
          </ScrollView>
        )}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  composeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 36,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 16,
  },
  listCard: {
    marginHorizontal: 16,
    borderRadius: 13,
    overflow: 'hidden',
  },
  archivedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  archivedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
