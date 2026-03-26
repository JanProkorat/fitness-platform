import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../constants/Colors';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';

// Progress data will come from the exercise progress API in future integration.
// For now, this screen provides the UI skeleton.

const CHART_WIDTH = Dimensions.get('window').width - 48;
const CHART_HEIGHT = 180;

export default function TrainingProgressScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.backButton} onPress={() => router.back()}>← {t('common.back')}</Text>
        <Text style={styles.title}>{t('training.progress')}</Text>
        <Text style={styles.subtitle}>{t('training.progressSubtitle')}</Text>
      </View>

      {/* Placeholder chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{t('training.strengthChart')}</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <Line
              key={i}
              x1={0}
              y1={(CHART_HEIGHT / 3) * i}
              x2={CHART_WIDTH}
              y2={(CHART_HEIGHT / 3) * i}
              stroke={Colors.dark.border}
              strokeWidth={1}
            />
          ))}
          <SvgText x={4} y={14} fill={Colors.dark.text3} fontSize={10}>
            {t('training.selectExercise')}
          </SvgText>
        </Svg>
      </View>

      {/* PR Timeline placeholder */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('training.prTimeline')}</Text>
        <Text style={styles.emptyHint}>{t('training.prTimelineHint')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backButton: { fontSize: 13, color: Colors.dark.gold, marginBottom: 12, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.dark.text },
  subtitle: { fontSize: 13, color: Colors.dark.text3, marginTop: 4 },
  chartCard: { marginHorizontal: 16, backgroundColor: Colors.dark.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.border, padding: 16, marginBottom: 16 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: Colors.dark.text2, marginBottom: 12 },
  sectionCard: { marginHorizontal: 16, backgroundColor: Colors.dark.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.dark.border, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.dark.text2 },
  emptyHint: { fontSize: 12, color: Colors.dark.text3, marginTop: 8 },
});
