import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { getTodaySession } from '@/api/training';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { data } = useQuery({
    queryKey: ['today-training'],
    queryFn: getTodaySession,
  });

  const session = data?.session;

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.backButton} onPress={() => router.back()}>← {t('common.back')}</Text>
        <Text style={styles.title}>{session.name}</Text>
        {session.notes && <Text style={styles.notes}>{session.notes}</Text>}
      </View>

      {session.exercises.map((exercise, idx) => (
        <View key={idx} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
          {exercise.notes && <Text style={styles.exerciseNotes}>{exercise.notes}</Text>}
          {exercise.restSeconds && (
            <Text style={styles.restTime}>{t('training.rest')}: {exercise.restSeconds}s</Text>
          )}
          <View style={styles.setsHeader}>
            <Text style={styles.setLabel}>{t('training.set')}</Text>
            <Text style={styles.setLabel}>{t('training.reps')}</Text>
            <Text style={styles.setLabel}>{t('training.weight')}</Text>
          </View>
          {exercise.sets.map((set, sIdx) => (
            <View key={sIdx} style={styles.setRow}>
              <Text style={styles.setNumber}>{set.setNumber}</Text>
              <Text style={styles.setValue}>{set.reps ?? '—'}</Text>
              <Text style={styles.setValue}>{set.weightKg ? `${set.weightKg} kg` : '—'}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
    backButton: { fontSize: 13, color: colors.gold, marginBottom: 12, fontWeight: '600' },
    title: { fontSize: 20, fontWeight: '800', color: colors.label },
    notes: { fontSize: 12, color: colors.label3, marginTop: 8, lineHeight: 18 },
    loadingText: { color: colors.label3, textAlign: 'center', marginTop: 100 },
    exerciseCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.bg2, borderRadius: 8, borderWidth: 1, borderColor: colors.sep, padding: 14 },
    exerciseName: { fontSize: 14, fontWeight: '700', color: colors.label },
    exerciseNotes: { fontSize: 11, color: colors.label3, marginTop: 6, fontStyle: 'italic' },
    restTime: { fontSize: 11, color: colors.gold, marginTop: 4 },
    setsHeader: { flexDirection: 'row', marginTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.sep },
    setLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.label3, textTransform: 'uppercase' },
    setRow: { flexDirection: 'row', paddingVertical: 6 },
    setNumber: { flex: 1, fontSize: 13, color: colors.label3, fontWeight: '600' },
    setValue: { flex: 1, fontSize: 13, color: colors.label2 },
  });
