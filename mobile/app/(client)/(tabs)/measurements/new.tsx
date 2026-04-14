import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { addMeasurement, getLatestMeasurement } from '@/api/measurements';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { addPendingMutation } from '@/stores/offline';

const DEFAULT_WEIGHT = 70.0;

export default function NewMeasurementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isConnected = useNetworkStatus();
  const colors = useTheme();

  const latestQuery = useQuery({
    queryKey: ['latest-measurement'],
    queryFn: getLatestMeasurement,
  });

  const startWeight = latestQuery.data?.weightKg ?? DEFAULT_WEIGHT;

  const [weight, setWeight] = useState<number | null>(null);
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [biceps, setBiceps] = useState('');
  const [thighs, setThighs] = useState('');
  const [notes, setNotes] = useState('');

  const effectiveWeight = weight ?? startWeight;

  const adjustWeight = (delta: number) => {
    setWeight(Math.max(0, parseFloat((effectiveWeight + delta).toFixed(1))));
  };

  const mutation = useMutation({
    mutationFn: addMeasurement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['measurement-stats'] });
      queryClient.invalidateQueries({ queryKey: ['latest-measurement'] });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save measurement. Please try again.');
    },
  });

  const handleSave = () => {
    const parseOptional = (v: string): number | undefined => {
      const n = parseFloat(v);
      return isNaN(n) ? undefined : n;
    };

    const request = {
      measuredAt: new Date().toISOString(),
      weightKg: effectiveWeight,
      bodyFatPercentage: parseOptional(bodyFat),
      chestCm: parseOptional(chest),
      waistCm: parseOptional(waist),
      hipsCm: parseOptional(hips),
      bicepsCm: parseOptional(biceps),
      thighsCm: parseOptional(thighs),
      notes: notes.trim() || undefined,
    };

    if (isConnected) {
      mutation.mutate(request);
    } else {
      addPendingMutation({
        method: 'POST',
        url: '/client/measurements',
        data: request,
      });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['measurement-stats'] });
      queryClient.invalidateQueries({ queryKey: ['latest-measurement'] });
      Alert.alert('Saved offline', 'Your measurement will be synced when you go online.');
      router.back();
    }
  };

  const isSaving = mutation.isPending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.gold }]}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.label }]}>New Measurement</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Weight section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>Weight</Text>
            <View style={[styles.weightCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
              <TouchableOpacity
                style={[styles.adjustButton, { backgroundColor: colors.bg2, borderColor: colors.sep }]}
                onPress={() => adjustWeight(-0.1)}
              >
                <Text style={[styles.adjustButtonText, { color: colors.label }]}>{'\u2212'}</Text>
              </TouchableOpacity>

              <View style={styles.weightDisplay}>
                <TextInput
                  style={[styles.weightInput, { color: colors.label }]}
                  value={effectiveWeight.toFixed(1)}
                  keyboardType="decimal-pad"
                  onChangeText={(v) => {
                    const n = parseFloat(v);
                    if (!isNaN(n)) setWeight(n);
                  }}
                  selectTextOnFocus
                />
                <Text style={[styles.weightUnit, { color: colors.label3 }]}>kg</Text>
              </View>

              <TouchableOpacity
                style={[styles.adjustButton, { backgroundColor: colors.bg2, borderColor: colors.sep }]}
                onPress={() => adjustWeight(0.1)}
              >
                <Text style={[styles.adjustButtonText, { color: colors.label }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body fat */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>Body Fat</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
                placeholder="e.g. 15.0"
                placeholderTextColor={colors.label3}
                keyboardType="decimal-pad"
                value={bodyFat}
                onChangeText={setBodyFat}
              />
              <Text style={[styles.inputSuffix, { color: colors.label3 }]}>%</Text>
            </View>
          </View>

          {/* Body measurements */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>Body Measurements (cm)</Text>
            <View style={styles.measureGrid}>
              <MeasureInput label="Chest" value={chest} onChange={setChest} colors={colors} />
              <MeasureInput label="Waist" value={waist} onChange={setWaist} colors={colors} />
              <MeasureInput label="Hips" value={hips} onChange={setHips} colors={colors} />
              <MeasureInput label="Biceps" value={biceps} onChange={setBiceps} colors={colors} />
              <MeasureInput label="Thighs" value={thighs} onChange={setThighs} colors={colors} />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
              placeholder="Optional notes..."
              placeholderTextColor={colors.label3}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.gold }, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.saveButtonText}>SAVE MEASUREMENT</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MeasureInput({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.measureItem}>
      <Text style={[styles.measureLabel, { color: colors.label3 }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg2, borderColor: colors.sep, color: colors.label }]}
        placeholder="--"
        placeholderTextColor={colors.label3}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  weightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    gap: 20,
  },
  adjustButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 24,
    fontWeight: '700',
  },
  weightDisplay: {
    alignItems: 'center',
  },
  weightInput: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 140,
    padding: 0,
  },
  weightUnit: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  inputSuffix: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 80,
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  measureItem: {
    width: '47%',
  },
  measureLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
