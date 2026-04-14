import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { href } from '@/lib/navigation';
import { getWorkoutLogs } from '@/api/workouts';
import type { WorkoutLogSummary } from '@/api/workouts';

export default function TrainingHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { data, isLoading } = useQuery({
    queryKey: ['workout-logs'],
    queryFn: () => getWorkoutLogs({ page: 1, pageSize: 50 }),
  });

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  const renderItem = useCallback(({ item }: { item: WorkoutLogSummary }) => (
    <Pressable
      style={styles.logCard}
      onPress={() => router.push(href(`/training/history/${item.logId}`))}
    >
      <View style={styles.logHeader}>
        <Text style={styles.logDate}>
          {new Date(item.startedAt).toLocaleDateString()}
        </Text>
        {item.hasPR && <Text style={styles.prBadge}>🏆 PR</Text>}
      </View>
      <View style={styles.logStats}>
        <Text style={styles.logStat}>{item.exerciseCount} {t('training.exercises')}</Text>
        <Text style={styles.logStat}>{item.setCount} {t('training.sets')}</Text>
        <Text style={styles.logStat}>{formatDuration(item.durationSeconds)}</Text>
      </View>
      {item.mood && (
        <Text style={styles.logMood}>
          {['😫', '😐', '🙂', '💪', '🔥'][item.mood - 1]}
        </Text>
      )}
    </Pressable>
  ), [styles, router, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.backButton} onPress={() => router.back()}>← {t('common.back')}</Text>
        <Text style={styles.title}>{t('training.history')}</Text>
      </View>
      <FlatList
        data={data?.logs ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.logId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.emptyText}>{t('training.noWorkouts')}</Text>
          )
        }
      />
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
    backButton: { fontSize: 13, color: colors.gold, marginBottom: 12, fontWeight: '600' },
    title: { fontSize: 20, fontWeight: '800', color: colors.label },
    list: { paddingHorizontal: 16 },
    logCard: { backgroundColor: colors.bg2, borderRadius: 8, borderWidth: 1, borderColor: colors.sep, padding: 14, marginBottom: 10 },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logDate: { fontSize: 14, fontWeight: '700', color: colors.label },
    prBadge: { fontSize: 12, color: colors.gold, fontWeight: '700' },
    logStats: { flexDirection: 'row', gap: 16, marginTop: 8 },
    logStat: { fontSize: 12, color: colors.label3 },
    logMood: { position: 'absolute', right: 14, top: 14, fontSize: 18 },
    emptyText: { textAlign: 'center', color: colors.label3, marginTop: 40, fontSize: 13 },
  });
