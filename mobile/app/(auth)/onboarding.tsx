import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { Colors } from '../../constants/Colors';

const TOTAL_STEPS = 7;

const BODY_TYPES = [
  { value: 'Ectomorph', label: 'Ectomorph', sub: 'Naturally slim, hard to gain weight' },
  { value: 'Mesomorph', label: 'Mesomorph', sub: 'Athletic build, responds well' },
  { value: 'Endomorph', label: 'Endomorph', sub: 'Tends to store fat' },
];

const GOALS = [
  { value: 'LoseFat', label: 'Lose fat', sub: 'Caloric deficit, cardio + strength' },
  { value: 'GainMuscle', label: 'Gain muscle', sub: 'Caloric surplus, strength training' },
  { value: 'Recomposition', label: 'Recomposition', sub: 'Lose fat & gain muscle simultaneously' },
  { value: 'Fitness', label: 'Improve fitness', sub: 'Functional fitness, endurance, energy' },
  { value: 'Health', label: 'Health & prevention', sub: 'Movement as lifestyle' },
];

const TIME_HORIZONS = [
  { value: 'ThreeMonths', label: '3 months', sub: 'Quick start' },
  { value: 'SixMonths', label: '6 months', sub: 'Realistic goal' },
  { value: 'OneYear', label: '1 year+', sub: 'Lasting change' },
];

const JOB_TYPES = [
  { value: 'Sedentary', label: 'Sedentary', sub: 'Office, desk work' },
  { value: 'Standing', label: 'Standing / moving', sub: 'Retail, teaching, healthcare' },
  { value: 'Physical', label: 'Physical work', sub: 'Construction, trade, sport' },
];

const CURRENT_FREQ = [
  { value: 'None', label: 'None', sub: '0× per week' },
  { value: 'Occasional', label: 'Occasional', sub: '1–2× per week' },
  { value: 'Regular', label: 'Regular', sub: '3–4× per week' },
  { value: 'High', label: 'High', sub: '5× or more' },
];

const DESIRED_FREQ = [
  { value: 'TwoPerWeek', label: '2× / week' },
  { value: 'ThreePerWeek', label: '3× / week' },
  { value: 'FourPerWeek', label: '4× / week' },
  { value: 'FivePerWeek', label: '5× / week' },
];

const GYM_ACCESS = [
  { value: 'Yes', label: 'Yes, I have membership' },
  { value: 'Sometimes', label: 'Sometimes / pay per visit' },
  { value: 'No', label: 'No, I train at home' },
];

const ACTIVITIES = [
  { value: 'strength', label: 'Strength training' },
  { value: 'cardio', label: 'Cardio / running' },
  { value: 'hiit', label: 'HIIT / circuit' },
  { value: 'yoga', label: 'Yoga / stretching' },
  { value: 'cycling', label: 'Cycling / outdoor' },
  { value: 'martial_arts', label: 'Martial arts' },
];

const INJURY_OPTIONS = [
  { value: 'none', label: 'No limitations' },
  { value: 'back', label: 'Back / spine' },
  { value: 'knees', label: 'Knees' },
  { value: 'shoulders', label: 'Shoulders' },
];

const MEALS_OPTIONS = [
  { value: 'TwoToThree', label: '2–3 meals' },
  { value: 'FourToFive', label: '4–5 meals' },
  { value: 'SixPlus', label: '6 or more' },
];

const DIET_STYLES = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Vegetarian', label: 'Vegetarian' },
  { value: 'Vegan', label: 'Vegan' },
  { value: 'GlutenFree', label: 'Gluten free' },
];

const ALLERGY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'lactose', label: 'Lactose' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'nuts', label: 'Nuts' },
];

const PLAN_EXP = [
  { value: 'Never', label: 'Never had a plan' },
  { value: 'TriedFailed', label: "Tried but didn't stick" },
  { value: 'TriedSucceeded', label: 'Yes, it worked for me' },
];

const BLOCKER_OPTIONS = [
  { value: 'time', label: 'Lack of time' },
  { value: 'motivation', label: 'Lost motivation' },
  { value: 'knowledge', label: "Didn't know how" },
  { value: 'slow_results', label: 'Results were slow' },
  { value: 'none', label: 'Nothing held me back' },
];

const MOTIVATIONS = [
  { value: 'Appearance', label: 'Better appearance' },
  { value: 'Health', label: 'Health & energy' },
  { value: 'Performance', label: 'Athletic performance' },
  { value: 'Confidence', label: 'Confidence' },
];

interface FormData {
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  bodyType: string;
  primaryGoal: string;
  timeHorizon: string;
  jobType: string;
  sleepHours: number;
  stressLevel: number;
  currentTrainingFrequency: string;
  desiredTrainingFrequency: string;
  fitnessRating: number;
  gymAccess: string;
  preferredActivities: string[];
  injuries: string[];
  mealsPerDay: string;
  dietaryStyle: string;
  allergies: string[];
  dietRating: number;
  planExperience: string;
  pastBlockers: string[];
  primaryMotivation: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    age: '', sex: '', heightCm: '', weightKg: '', targetWeightKg: '',
    bodyType: '', primaryGoal: '', timeHorizon: '', jobType: '',
    sleepHours: 0, stressLevel: 0, currentTrainingFrequency: '',
    desiredTrainingFrequency: '', fitnessRating: 0, gymAccess: '',
    preferredActivities: [], injuries: [], mealsPerDay: '', dietaryStyle: '',
    allergies: [], dietRating: 0, planExperience: '', pastBlockers: [],
    primaryMotivation: '',
  });

  const set = (key: keyof FormData, value: FormData[keyof FormData]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleMulti = (key: 'preferredActivities' | 'injuries' | 'allergies' | 'pastBlockers', value: string) => {
    setForm(prev => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!form.age && !!form.sex && !!form.heightCm && !!form.weightKg && !!form.bodyType;
      case 2: return !!form.primaryGoal && !!form.timeHorizon;
      case 3: return !!form.jobType && form.sleepHours > 0 && form.stressLevel > 0;
      case 4: return !!form.currentTrainingFrequency && !!form.desiredTrainingFrequency && form.fitnessRating > 0;
      case 5: return !!form.gymAccess;
      case 6: return !!form.mealsPerDay && !!form.dietaryStyle && form.dietRating > 0;
      case 7: return !!form.planExperience && !!form.primaryMotivation;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/client/onboarding', {
        age: parseInt(form.age),
        sex: form.sex,
        heightCm: parseFloat(form.heightCm),
        weightKg: parseFloat(form.weightKg),
        targetWeightKg: form.targetWeightKg ? parseFloat(form.targetWeightKg) : null,
        bodyType: form.bodyType,
        primaryGoal: form.primaryGoal,
        timeHorizon: form.timeHorizon,
        jobType: form.jobType,
        sleepHours: form.sleepHours,
        stressLevel: form.stressLevel,
        currentTrainingFrequency: form.currentTrainingFrequency,
        desiredTrainingFrequency: form.desiredTrainingFrequency,
        fitnessRating: form.fitnessRating,
        gymAccess: form.gymAccess,
        preferredActivities: form.preferredActivities,
        injuries: form.injuries,
        mealsPerDay: form.mealsPerDay,
        dietaryStyle: form.dietaryStyle,
        allergies: form.allergies,
        dietRating: form.dietRating,
        planExperience: form.planExperience,
        pastBlockers: form.pastBlockers,
        primaryMotivation: form.primaryMotivation,
      });
      const user = useAuthStore.getState().user;
      if (user) {
        useAuthStore.setState({
          user: { ...user, isOnboardingComplete: true },
        });
      }
      router.replace('/(client)');
    } catch {
      Alert.alert('Error', 'Failed to save onboarding data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const OptionCard = ({ label, sub, selected, onPress }: {
    label: string; sub?: string; selected: boolean; onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress} activeOpacity={0.7}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      {sub && <Text style={[styles.optionSub, selected && styles.optionSubSelected]}>{sub}</Text>}
    </TouchableOpacity>
  );

  const CheckboxItem = ({ label, selected, onPress }: {
    label: string; selected: boolean; onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.checkboxItem, selected && styles.checkboxSelected]}
      onPress={onPress} activeOpacity={0.7}
    >
      <View style={[styles.checkboxBox, selected && styles.checkboxBoxSelected]}>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.checkboxLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const ScaleRow = ({ count, value, onSelect }: {
    count: number; value: number; onSelect: (n: number) => void;
  }) => (
    <View style={styles.scaleRow}>
      {Array.from({ length: count }, (_, i) => i + 1).map(n => (
        <TouchableOpacity
          key={n}
          style={[styles.scaleBtn, value === n && styles.scaleBtnSelected]}
          onPress={() => onSelect(n)}
        >
          <Text style={[styles.scaleBtnText, value === n && styles.scaleBtnTextSelected]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <>
          <Text style={styles.stepTitle}>Basic Info</Text>
          <Text style={styles.stepSub}>Helps us set the right starting point for your plan.</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Age</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={form.age}
                onChangeText={v => set('age', v)} placeholder="25" placeholderTextColor={Colors.dark.muted} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Sex</Text>
              <View style={styles.row}>
                {['Male', 'Female'].map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.optionCard, styles.flex1, form.sex === s && styles.optionCardSelected]}
                    onPress={() => set('sex', s)}>
                    <Text style={[styles.optionLabel, form.sex === s && styles.optionLabelSelected]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={form.heightCm}
                onChangeText={v => set('heightCm', v)} placeholder="175" placeholderTextColor={Colors.dark.muted} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={form.weightKg}
                onChangeText={v => set('weightKg', v)} placeholder="75" placeholderTextColor={Colors.dark.muted} />
            </View>
          </View>
          <Text style={styles.label}>Target weight (kg) — optional</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={form.targetWeightKg}
            onChangeText={v => set('targetWeightKg', v)} placeholder="70" placeholderTextColor={Colors.dark.muted} />
          <Text style={styles.label}>Body type</Text>
          {BODY_TYPES.map(o => (
            <OptionCard key={o.value} label={o.label} sub={o.sub}
              selected={form.bodyType === o.value} onPress={() => set('bodyType', o.value)} />
          ))}
        </>
      );
      case 2: return (
        <>
          <Text style={styles.stepTitle}>Your Main Goal</Text>
          <Text style={styles.stepSub}>We'll adjust caloric intake and training type based on this.</Text>
          <Text style={styles.label}>What do you want to achieve?</Text>
          {GOALS.map(o => (
            <OptionCard key={o.value} label={o.label} sub={o.sub}
              selected={form.primaryGoal === o.value} onPress={() => set('primaryGoal', o.value)} />
          ))}
          <Text style={[styles.label, { marginTop: 16 }]}>Time horizon</Text>
          <View style={styles.row}>
            {TIME_HORIZONS.map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub}
                selected={form.timeHorizon === o.value} onPress={() => set('timeHorizon', o.value)} />
            ))}
          </View>
        </>
      );
      case 3: return (
        <>
          <Text style={styles.stepTitle}>Lifestyle</Text>
          <Text style={styles.stepSub}>Helps us estimate your daily energy expenditure.</Text>
          <Text style={styles.label}>Job type / daily activity</Text>
          {JOB_TYPES.map(o => (
            <OptionCard key={o.value} label={o.label} sub={o.sub}
              selected={form.jobType === o.value} onPress={() => set('jobType', o.value)} />
          ))}
          <Text style={[styles.label, { marginTop: 16 }]}>Average sleep (hours)</Text>
          <ScaleRow count={7} value={form.sleepHours - 3} onSelect={n => set('sleepHours', n + 3)} />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>4h</Text>
            <Text style={styles.scaleLabelText}>10h</Text>
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Stress level</Text>
          <ScaleRow count={5} value={form.stressLevel} onSelect={n => set('stressLevel', n)} />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>No stress</Text>
            <Text style={styles.scaleLabelText}>Extreme</Text>
          </View>
        </>
      );
      case 4: return (
        <>
          <Text style={styles.stepTitle}>Current Activity</Text>
          <Text style={styles.stepSub}>Be honest — the plan only works based on reality.</Text>
          <Text style={styles.label}>How often did you train in the last 4 weeks?</Text>
          <View style={styles.row}>
            {CURRENT_FREQ.map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub}
                selected={form.currentTrainingFrequency === o.value}
                onPress={() => set('currentTrainingFrequency', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>How often do you want to train (realistically)?</Text>
          <View style={styles.row}>
            {DESIRED_FREQ.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.desiredTrainingFrequency === o.value}
                onPress={() => set('desiredTrainingFrequency', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Current fitness level</Text>
          <ScaleRow count={10} value={form.fitnessRating} onSelect={n => set('fitnessRating', n)} />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>Very poor</Text>
            <Text style={styles.scaleLabelText}>Athlete</Text>
          </View>
        </>
      );
      case 5: return (
        <>
          <Text style={styles.stepTitle}>Equipment & Preferences</Text>
          <Text style={styles.stepSub}>Your plan will only use what you actually have access to.</Text>
          <Text style={styles.label}>Gym access</Text>
          {GYM_ACCESS.map(o => (
            <OptionCard key={o.value} label={o.label}
              selected={form.gymAccess === o.value} onPress={() => set('gymAccess', o.value)} />
          ))}
          <Text style={[styles.label, { marginTop: 16 }]}>Preferred activities (select all that apply)</Text>
          <View style={styles.grid}>
            {ACTIVITIES.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.preferredActivities.includes(o.value)}
                onPress={() => toggleMulti('preferredActivities', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Injuries or limitations</Text>
          <View style={styles.grid}>
            {INJURY_OPTIONS.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.injuries.includes(o.value)}
                onPress={() => toggleMulti('injuries', o.value)} />
            ))}
          </View>
        </>
      );
      case 6: return (
        <>
          <Text style={styles.stepTitle}>Nutrition</Text>
          <Text style={styles.stepSub}>We'll adapt the meal plan to your habits — not the other way around.</Text>
          <Text style={styles.label}>Meals per day</Text>
          <View style={styles.row}>
            {MEALS_OPTIONS.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.mealsPerDay === o.value} onPress={() => set('mealsPerDay', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Dietary style</Text>
          <View style={styles.grid}>
            {DIET_STYLES.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.dietaryStyle === o.value} onPress={() => set('dietaryStyle', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Allergies / intolerances</Text>
          <View style={styles.grid}>
            {ALLERGY_OPTIONS.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.allergies.includes(o.value)}
                onPress={() => toggleMulti('allergies', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Diet quality rating</Text>
          <ScaleRow count={5} value={form.dietRating} onSelect={n => set('dietRating', n)} />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>Very poor</Text>
            <Text style={styles.scaleLabelText}>Excellent</Text>
          </View>
        </>
      );
      case 7: return (
        <>
          <Text style={styles.stepTitle}>Experience & Motivation</Text>
          <Text style={styles.stepSub}>Last step — helps us set the right intensity and approach.</Text>
          <Text style={styles.label}>Experience with structured plans</Text>
          {PLAN_EXP.map(o => (
            <OptionCard key={o.value} label={o.label}
              selected={form.planExperience === o.value} onPress={() => set('planExperience', o.value)} />
          ))}
          <Text style={[styles.label, { marginTop: 16 }]}>What held you back in the past?</Text>
          <View style={styles.grid}>
            {BLOCKER_OPTIONS.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.pastBlockers.includes(o.value)}
                onPress={() => toggleMulti('pastBlockers', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Primary motivation</Text>
          <View style={styles.grid}>
            {MOTIVATIONS.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.primaryMotivation === o.value} onPress={() => set('primaryMotivation', o.value)} />
            ))}
          </View>
        </>
      );
      default: return null;
    }
  };

  const renderSummary = () => {
    const summaryRows: { label: string; value: string }[] = [
      { label: 'Age', value: form.age },
      { label: 'Sex', value: form.sex },
      { label: 'Height', value: `${form.heightCm} cm` },
      { label: 'Weight', value: `${form.weightKg} kg` },
      ...(form.targetWeightKg ? [{ label: 'Target weight', value: `${form.targetWeightKg} kg` }] : []),
      { label: 'Body type', value: form.bodyType },
      { label: 'Goal', value: form.primaryGoal },
      { label: 'Time horizon', value: form.timeHorizon },
      { label: 'Job type', value: form.jobType },
      { label: 'Sleep', value: `${form.sleepHours}h` },
      { label: 'Stress', value: `${form.stressLevel}/5` },
      { label: 'Current training', value: form.currentTrainingFrequency },
      { label: 'Desired training', value: form.desiredTrainingFrequency },
      { label: 'Fitness level', value: `${form.fitnessRating}/10` },
      { label: 'Gym access', value: form.gymAccess },
      ...(form.preferredActivities.length ? [{ label: 'Activities', value: form.preferredActivities.join(', ') }] : []),
      ...(form.injuries.length ? [{ label: 'Injuries', value: form.injuries.join(', ') }] : []),
      { label: 'Meals/day', value: form.mealsPerDay },
      { label: 'Diet style', value: form.dietaryStyle },
      ...(form.allergies.length ? [{ label: 'Allergies', value: form.allergies.join(', ') }] : []),
      { label: 'Diet rating', value: `${form.dietRating}/5` },
      { label: 'Plan experience', value: form.planExperience },
      ...(form.pastBlockers.length ? [{ label: 'Past blockers', value: form.pastBlockers.join(', ') }] : []),
      { label: 'Motivation', value: form.primaryMotivation },
    ];

    return (
      <>
        <Text style={styles.stepTitle}>Summary</Text>
        <Text style={styles.stepSub}>Review your answers before submitting.</Text>
        <View style={styles.summaryCard}>
          {summaryRows.map(({ label, value }) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  const isSummary = step > TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: isSummary ? '100%' : `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isSummary && <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>}
        {isSummary ? renderSummary() : renderStep()}
      </ScrollView>

      <View style={styles.nav}>
        <Text style={styles.navInfo}>{isSummary ? 'Ready to submit' : `Step ${step} of ${TOTAL_STEPS}`}</Text>
        <View style={styles.btnRow}>
          {(step > 1 || isSummary) && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {isSummary ? (
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.nextBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          ) : step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance() && styles.btnDisabled]}
              onPress={() => canAdvance() && setStep(s => s + 1)}
              disabled={!canAdvance()}>
              <Text style={styles.nextBtnText}>Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance() && styles.btnDisabled]}
              onPress={() => canAdvance() && setStep(TOTAL_STEPS + 1)}
              disabled={!canAdvance()}>
              <Text style={styles.nextBtnText}>Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  progressBar: { height: 3, backgroundColor: Colors.dark.border, marginHorizontal: 16, marginTop: 60 },
  progressFill: { height: '100%', backgroundColor: Colors.dark.gold, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  stepLabel: { fontSize: 12, color: Colors.dark.muted, marginBottom: 4 },
  stepTitle: { fontSize: 22, fontWeight: '600', color: Colors.dark.text, marginBottom: 4 },
  stepSub: { fontSize: 14, color: Colors.dark.text3, lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 13, color: Colors.dark.muted, marginBottom: 8 },
  input: {
    backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border,
    borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    color: Colors.dark.text, marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  halfField: { flex: 1 },
  flex1: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  optionCard: {
    borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.dark.surface, minWidth: 80,
  },
  optionCardSelected: { borderColor: Colors.dark.gold, backgroundColor: 'rgba(201,168,76,0.08)' },
  optionLabel: { fontSize: 14, fontWeight: '500', color: Colors.dark.text },
  optionLabelSelected: { color: Colors.dark.gold },
  optionSub: { fontSize: 12, color: Colors.dark.muted, marginTop: 2 },
  optionSubSelected: { color: Colors.dark.gold, opacity: 0.75 },
  checkboxItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.dark.border, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.dark.surface,
    minWidth: '47%',
  },
  checkboxSelected: { borderColor: Colors.dark.gold, backgroundColor: 'rgba(201,168,76,0.08)' },
  checkboxBox: {
    width: 18, height: 18, borderWidth: 1, borderColor: Colors.dark.border,
    borderRadius: 3, alignItems: 'center', justifyContent: 'center',
  },
  checkboxBoxSelected: { backgroundColor: Colors.dark.gold, borderColor: Colors.dark.gold },
  checkmark: { fontSize: 11, color: '#000', fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: Colors.dark.text },
  scaleRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  scaleBtn: {
    flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: Colors.dark.border,
    borderRadius: 4, alignItems: 'center', backgroundColor: Colors.dark.surface,
  },
  scaleBtnSelected: { borderColor: Colors.dark.gold, backgroundColor: 'rgba(201,168,76,0.08)' },
  scaleBtnText: { fontSize: 13, color: Colors.dark.muted },
  scaleBtnTextSelected: { color: Colors.dark.gold, fontWeight: '600' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  scaleLabelText: { fontSize: 11, color: Colors.dark.muted },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },
  navInfo: { fontSize: 13, color: Colors.dark.muted },
  btnRow: { flexDirection: 'row', gap: 8 },
  backBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4,
    borderWidth: 1, borderColor: Colors.dark.border,
  },
  backBtnText: { fontSize: 14, color: Colors.dark.text3, fontWeight: '600' },
  nextBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4,
    backgroundColor: Colors.dark.gold, minWidth: 100, alignItems: 'center',
  },
  nextBtnText: { fontSize: 14, color: '#000', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  btnDisabled: { opacity: 0.4 },
  summaryCard: {
    backgroundColor: Colors.dark.surface, borderRadius: 8, padding: 16, marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: Colors.dark.border,
  },
  summaryLabel: { fontSize: 14, color: Colors.dark.muted },
  summaryValue: { fontSize: 14, fontWeight: '500', color: Colors.dark.text },
});
