import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../constants/Colors';
import { getWorkoutLogs } from '../../../src/api/workouts';
import type { WorkoutLogSummary } from '../../../src/api/workouts';

export default function TrainingHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['workout-logs'],
    queryFn: () => getWorkoutLogs({ page: 1, pageSize: 50 }),
  });

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  const renderItem = ({ item }: { item: WorkoutLogSummary }) => (
    <Pressable
      style={styles.logCard}
      onPress={() => router.push(`/training/history/${item.logId}` as any)}
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
  );

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backButton: { fontSize: 13, color: Colors.dark.gold, marginBottom: 12, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  list: { paddingHorizontal: 16 },
  logCard: { backgroundColor: Colors.dark.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.border, padding: 14, marginBottom: 10 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logDate: { fontSize: 14, fontWeight: '700', color: Colors.dark.text },
  prBadge: { fontSize: 12, color: Colors.dark.gold, fontWeight: '700' },
  logStats: { flexDirection: 'row', gap: 16, marginTop: 8 },
  logStat: { fontSize: 12, color: Colors.dark.text3 },
  logMood: { position: 'absolute', right: 14, top: 14, fontSize: 18 },
  emptyText: { textAlign: 'center', color: Colors.dark.text3, marginTop: 40, fontSize: 13 },
});
