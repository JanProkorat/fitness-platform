import React from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { ConversationRow } from '@/components/messages/ConversationRow'
import { fetchConversations, unarchiveConversation } from '../../../src/api/messages'

export default function ArchivedMessagesScreen() {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['archived-conversations'],
    queryFn: () => fetchConversations(true),
    staleTime: 10_000,
  })

  const unarchiveMutation = useMutation({
    mutationFn: unarchiveConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['archived-conversations'] })
    },
  })

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.sep2 }]}>
          <Pressable onPress={() => router.navigate('/(client)/messages' as never)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.blue} />
            <Text style={{ fontSize: 16, color: colors.blue }}>Messages</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.label }]}>Archived</Text>
          <View style={{ width: 90 }} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : !conversations || conversations.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="archive-outline" size={48} color={colors.label3} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyTitle, { color: colors.label2 }]}>
              No archived conversations
            </Text>
            <Text style={[styles.emptySub, { color: colors.label3 }]}>
              Conversations you archive will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            <View style={[styles.listCard, { backgroundColor: colors.bg2 }]}>
              {conversations.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && (
                    <View style={{ paddingLeft: 78 }}>
                      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.sep2 }} />
                    </View>
                  )}
                  <ConversationRow
                    conversation={item}
                    variant="archived"
                    onPress={() => router.push(`/(client)/messages/${item.id}` as never)}
                    onUnarchive={() => unarchiveMutation.mutate(item.id)}
                  />
                </React.Fragment>
              ))}
            </View>
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
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  listCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 13,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
})
