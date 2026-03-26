import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import type { FoodSummary } from '../api/foods';

interface FoodDetailSheetProps {
  food: FoodSummary | null;
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

export function FoodDetailSheet({ food, visible, onClose }: FoodDetailSheetProps) {
  if (!food) return null;

  const { nutrientValue } = food;

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
              <View style={styles.badges}>
                {food.source && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{food.source}</Text>
                  </View>
                )}
              </View>
              {food.barcode && (
                <Text style={styles.barcode}>Barcode: {food.barcode}</Text>
              )}
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
                value={nutrientValue.kcal}
                unit=""
                color={Colors.dark.kcal}
              />
              <NutrientCard
                label="Protein"
                value={nutrientValue.protein}
                unit="g"
                color={Colors.dark.protein}
              />
              <NutrientCard
                label="Carbs"
                value={nutrientValue.carbs}
                unit="g"
                color={Colors.dark.carbs}
              />
              <NutrientCard
                label="Fat"
                value={nutrientValue.fat}
                unit="g"
                color={Colors.dark.fat}
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
            {food.allergens.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Allergens</Text>
                <View style={styles.allergenRow}>
                  {food.allergens.map((allergen) => (
                    <View key={allergen} style={styles.allergenChip}>
                      <Text style={styles.allergenText}>{allergen}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Common Servings */}
            {food.commonServings.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Common Servings</Text>
                {food.commonServings.map((serving) => (
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
  return (
    <View style={styles.extraRow}>
      <Text style={styles.extraLabel}>{label}</Text>
      <Text style={styles.extraValue}>{Math.round(value * 10) / 10} g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: Colors.dark.surface,
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
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text3,
  },
  barcode: {
    fontSize: 12,
    color: Colors.dark.text3,
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: Colors.dark.text2,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text3,
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
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
  },
  nutrientLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.text3,
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
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  extraLabel: {
    fontSize: 13,
    color: Colors.dark.text2,
  },
  extraValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
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
    borderColor: Colors.dark.red,
  },
  allergenText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.red,
  },
  servingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  servingLabel: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  servingWeight: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text2,
  },
  bottomSpacer: {
    height: 24,
  },
});
