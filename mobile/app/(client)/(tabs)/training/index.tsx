import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { hrefParams } from '@/lib/navigation';
import { getTodaySession } from '@/api/training';

export default function TrainingIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['today-training'],
    queryFn: getTodaySession,
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.gold} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('training.title')}</Text>
        <Text style={styles.subtitle}>{t('training.todayOverview')}</Text>
      </View>

      {data?.hasSession && data.session ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{data.session.name}</Text>
            <Text style={styles.cardMeta}>
              {data.session.exercises.length} {t('training.exercises')} · {data.session.exercises.reduce((sum, e) => sum + e.sets.length, 0)} {t('training.sets')}
            </Text>
            {data.currentWeek != null && data.totalWeeks != null && (
              <Text style={styles.weekBadge}>
                {t('training.weekProgress', { current: data.currentWeek, total: data.totalWeeks })}
              </Text>
            )}
          </View>

          {data.session.exercises.map((exercise, idx) => (
            <View key={idx} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
              <Text style={styles.exerciseSets}>
                {exercise.sets.length} × {exercise.sets[0]?.reps ?? '—'}
                {exercise.sets[0]?.weightKg ? ` @ ${exercise.sets[0].weightKg} kg` : ''}
              </Text>
            </View>
          ))}

          <Pressable
            style={styles.startButton}
            onPress={() => router.push(hrefParams('/training/log/[id]', { id: 'new', planId: data.planId ?? '', sessionId: data.session!.sessionId }))}
          >
            <Text style={styles.startButtonText}>{t('training.startWorkout')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏋️</Text>
          <Text style={styles.emptyText}>{t('training.restDay')}</Text>
          <Text style={styles.emptyHint}>{t('training.restDayHint')}</Text>
        </View>
      )}

      {/* Quick history link */}
      <Pressable
        style={styles.historyLink}
        onPress={() => router.push(hrefParams('/training/history', {}))}
      >
        <Text style={styles.historyLinkText}>{t('training.viewHistory')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: colors.label },
    subtitle: { fontSize: 13, color: colors.label3, marginTop: 4 },
    card: { marginHorizontal: 16, backgroundColor: colors.bg2, borderRadius: 8, borderWidth: 1, borderColor: colors.sep, padding: 16 },
    cardHeader: { marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.label },
    cardMeta: { fontSize: 12, color: colors.label3, marginTop: 4 },
    weekBadge: { fontSize: 11, color: colors.gold, marginTop: 4, fontWeight: '600' },
    exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.sep },
    exerciseName: { fontSize: 13, fontWeight: '600', color: colors.label2, flex: 1 },
    exerciseSets: { fontSize: 12, color: colors.label3 },
    startButton: { backgroundColor: colors.gold, borderRadius: 6, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    startButtonText: { color: '#000', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    emptyCard: { marginHorizontal: 16, backgroundColor: colors.bg2, borderRadius: 8, borderWidth: 1, borderColor: colors.sep, padding: 32, alignItems: 'center' },
    emptyIcon: { fontSize: 40 },
    emptyText: { fontSize: 15, fontWeight: '700', color: colors.label2, marginTop: 12 },
    emptyHint: { fontSize: 12, color: colors.label3, marginTop: 4 },
    historyLink: { marginHorizontal: 16, marginTop: 16, paddingVertical: 12, alignItems: 'center' },
    historyLinkText: { fontSize: 13, color: colors.gold, fontWeight: '600' },
  });
