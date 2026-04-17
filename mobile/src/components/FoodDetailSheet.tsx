import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { FoodSummary } from '@/api/foods';

interface FoodDetailSheetProps {
  food: FoodSummary | null;
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

export function FoodDetailSheet({ food, visible, onClose }: FoodDetailSheetProps) {
  const colors = useTheme();

  if (!food) return null;

  // Generated types make all fields optional; guard with ?? fallbacks at runtime.
  const nutrientValue = food.nutrientValue ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  const allergens = food.allergens ?? []
  const commonServings = food.commonServings ?? []
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.foodName} numberOfLines={2}>
                {food.name}
              </Text>
              {/* source field removed — use rawName/nameEn from generated FoodSummary if needed */}
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Nutrient Grid — per 100 g */}
            <Text style={styles.sectionTitle}>Per 100 g</Text>
            <View style={styles.nutrientGrid}>
              <NutrientCard
                label="Kcal"
                value={nutrientValue.kcal ?? 0}
                unit=""
                color={colors.orange}
              />
              <NutrientCard
                label="Protein"
                value={nutrientValue.protein ?? 0}
                unit="g"
                color={colors.macroProtein}
              />
              <NutrientCard
                label="Carbs"
                value={nutrientValue.carbs ?? 0}
                unit="g"
                color={colors.macroCarbs}
              />
              <NutrientCard
                label="Fat"
                value={nutrientValue.fat ?? 0}
                unit="g"
                color={colors.macroFat}
              />
            </View>

            {/* Extra nutrients */}
            {(nutrientValue.fiber != null ||
              nutrientValue.sugar != null ||
              nutrientValue.saturatedFat != null ||
              nutrientValue.salt != null) && (
              <View style={styles.extraNutrients}>
                {nutrientValue.fiber != null && (
                  <ExtraNutrientRow label="Fiber" value={nutrientValue.fiber} />
                )}
                {nutrientValue.sugar != null && (
                  <ExtraNutrientRow label="Sugar" value={nutrientValue.sugar} />
                )}
                {nutrientValue.saturatedFat != null && (
                  <ExtraNutrientRow label="Saturated Fat" value={nutrientValue.saturatedFat} />
                )}
                {nutrientValue.salt != null && (
                  <ExtraNutrientRow label="Salt" value={nutrientValue.salt} />
                )}
              </View>
            )}

            {/* Allergens */}
            {allergens.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Allergens</Text>
                <View style={styles.allergenRow}>
                  {allergens.map((allergen) => (
                    <View key={allergen} style={styles.allergenChip}>
                      <Text style={styles.allergenText}>{allergen}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Common Servings */}
            {commonServings.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Common Servings</Text>
                {commonServings.map((serving) => (
                  <View key={serving.label} style={styles.servingRow}>
                    <Text style={styles.servingLabel}>{serving.label}</Text>
                    <Text style={styles.servingWeight}>{serving.weightGrams} g</Text>
                  </View>
                ))}
              </>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NutrientCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.nutrientCard}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={[styles.nutrientValue, { color }]}>
        {Math.round(value * 10) / 10}
        {unit ? <Text style={styles.nutrientUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function ExtraNutrientRow({ label, value }: { label: string; value: number }) {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.extraRow}>
      <Text style={styles.extraLabel}>{label}</Text>
      <Text style={styles.extraValue}>{Math.round(value * 10) / 10} g</Text>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      height: SHEET_HEIGHT,
      backgroundColor: colors.bg2,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.sep,
    },
    headerLeft: {
      flex: 1,
      marginRight: 12,
    },
    foodName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.label,
    },
    badges: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 6,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: colors.bg3,
      borderWidth: 1,
      borderColor: colors.sep,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.label3,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bg3,
      borderWidth: 1,
      borderColor: colors.sep,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeText: {
      fontSize: 14,
      color: colors.label2,
      fontWeight: '600',
    },
    scrollContent: {
      flex: 1,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.label3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 10,
    },
    nutrientGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    nutrientCard: {
      width: '48%',
      backgroundColor: colors.bg3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.sep,
      padding: 12,
    },
    nutrientLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.label3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    nutrientValue: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 4,
    },
    nutrientUnit: {
      fontSize: 13,
      fontWeight: '400',
    },
    extraNutrients: {
      marginTop: 12,
      backgroundColor: colors.bg3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.sep,
      overflow: 'hidden',
    },
    extraRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.sep,
    },
    extraLabel: {
      fontSize: 13,
      color: colors.label2,
    },
    extraValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.label,
    },
    allergenRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    allergenChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: 'rgba(239,68,68,0.15)',
      borderWidth: 1,
      borderColor: colors.red,
    },
    allergenText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.red,
    },
    servingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.sep,
    },
    servingLabel: {
      fontSize: 14,
      color: colors.label,
    },
    servingWeight: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.label2,
    },
    bottomSpacer: {
      height: 24,
    },
  });
}
