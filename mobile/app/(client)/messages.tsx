import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Separator } from '@/components/ui/Separator'
import { ConversationRow } from '@/components/messages/ConversationRow'
import { fetchConversations } from '../../src/api/messages'
import api from '../../src/api/client'
import type { Conversation } from '../../src/types/messages'

export default function MessagesScreen() {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const archiveMutation = useMutation({
    mutationFn: (conversationId: string) =>
      api.post(`/conversations/${conversationId}/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const filtered = useMemo(() => {
    if (!conversations) return []
    const list = search.trim()
      ? conversations.filter((c) =>
          c.participant.name.toLowerCase().includes(search.toLowerCase()),
        )
      : conversations

    return [...list].sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      )
    })
  }, [conversations, search])

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow
        conversation={item}
        onPress={() => router.push(`/(client)/messages/${item.id}` as never)}
        onArchive={() => archiveMutation.mutate(item.id)}
      />
    ),
    [router, archiveMutation],
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>Messages</Text>
        <Pressable style={[styles.composeBtn, { backgroundColor: colors.fill }]}>
          <Ionicons name="create-outline" size={18} color={colors.blue} />
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: colors.fill }]}>
          <Ionicons name="search" size={16} color={colors.label3} />
          <TextInput
            style={[styles.searchInput, { color: colors.label }]}
            placeholder="Search"
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
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color={colors.label3}
          />
          <Text style={[Type.body, { color: colors.label2, marginTop: 12 }]}>
            {search ? 'No conversations found' : 'No messages yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => (
            <View style={{ paddingLeft: 78 }}>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep2 }} />
            </View>
          )}
          style={[styles.listCard, { backgroundColor: colors.bg2 }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        />
      )}
    </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
