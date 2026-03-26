import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { Colors } from '../../constants/Colors';

const TOTAL_STEPS = 7;

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

  preferredActivities: string[];
  injuries: string[];
  mealsPerDay: string;
  dietaryStyle: string;
  allergies: string[];

  planExperience: string;
  pastBlockers: string[];
  primaryMotivation: string;
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [customActivity, setCustomActivity] = useState('');
  const [customInjury, setCustomInjury] = useState('');
  const [customDiet, setCustomDiet] = useState('');
  const [customAllergy, setCustomAllergy] = useState('');
  const [form, setForm] = useState<FormData>({
    age: '', sex: '', heightCm: '', weightKg: '', targetWeightKg: '',
    bodyType: '', primaryGoal: '', timeHorizon: '', jobType: '',
    sleepHours: 0, stressLevel: 0, currentTrainingFrequency: '',
    desiredTrainingFrequency: '', fitnessRating: 0,
    preferredActivities: [], injuries: [], mealsPerDay: '', dietaryStyle: '',
    allergies: [], planExperience: '', pastBlockers: [],
    primaryMotivation: '',
  });

  const BODY_TYPES = [
    { value: 'Ectomorph', label: t('onboarding.step1.ectomorph'), sub: t('onboarding.step1.ectomorphSub') },
    { value: 'Mesomorph', label: t('onboarding.step1.mesomorph'), sub: t('onboarding.step1.mesomorphSub') },
    { value: 'Endomorph', label: t('onboarding.step1.endomorph'), sub: t('onboarding.step1.endomorphSub') },
  ];

  const GOALS = [
    { value: 'LoseFat', label: t('onboarding.step2.loseFat'), sub: t('onboarding.step2.loseFatSub') },
    { value: 'GainMuscle', label: t('onboarding.step2.gainMuscle'), sub: t('onboarding.step2.gainMuscleSub') },
    { value: 'Recomposition', label: t('onboarding.step2.recomposition'), sub: t('onboarding.step2.recompositionSub') },
    { value: 'Fitness', label: t('onboarding.step2.fitness'), sub: t('onboarding.step2.fitnessSub') },
    { value: 'Health', label: t('onboarding.step2.health'), sub: t('onboarding.step2.healthSub') },
  ];

  const TIME_HORIZONS = [
    { value: 'ThreeMonths', label: t('onboarding.step2.threeMonths'), sub: t('onboarding.step2.threeMonthsSub') },
    { value: 'SixMonths', label: t('onboarding.step2.sixMonths'), sub: t('onboarding.step2.sixMonthsSub') },
    { value: 'OneYear', label: t('onboarding.step2.oneYear'), sub: t('onboarding.step2.oneYearSub') },
  ];

  const JOB_TYPES = [
    { value: 'Sedentary', label: t('onboarding.step3.sedentary'), sub: t('onboarding.step3.sedentarySub') },
    { value: 'Standing', label: t('onboarding.step3.standing'), sub: t('onboarding.step3.standingSub') },
    { value: 'Physical', label: t('onboarding.step3.physical'), sub: t('onboarding.step3.physicalSub') },
  ];

  const CURRENT_FREQ = [
    { value: 'None', label: t('onboarding.step4.none'), sub: t('onboarding.step4.noneSub') },
    { value: 'Occasional', label: t('onboarding.step4.occasional'), sub: t('onboarding.step4.occasionalSub') },
    { value: 'Regular', label: t('onboarding.step4.regular'), sub: t('onboarding.step4.regularSub') },
    { value: 'High', label: t('onboarding.step4.high'), sub: t('onboarding.step4.highSub') },
  ];

  const DESIRED_FREQ = [
    { value: 'TwoPerWeek', label: t('onboarding.step4.twoPerWeek') },
    { value: 'ThreePerWeek', label: t('onboarding.step4.threePerWeek') },
    { value: 'FourPerWeek', label: t('onboarding.step4.fourPerWeek') },
    { value: 'FivePerWeek', label: t('onboarding.step4.fivePerWeek') },
  ];

  const ACTIVITIES = [
    { value: 'strength', label: t('onboarding.step5.strength') },
    { value: 'cardio', label: t('onboarding.step5.cardio') },
    { value: 'hiit', label: t('onboarding.step5.hiit') },
    { value: 'yoga', label: t('onboarding.step5.yoga') },
    { value: 'cycling', label: t('onboarding.step5.cycling') },
    { value: 'martial_arts', label: t('onboarding.step5.martialArts') },
  ];

  const INJURY_OPTIONS = [
    { value: 'none', label: t('onboarding.step5.noLimitations') },
    { value: 'back', label: t('onboarding.step5.back') },
    { value: 'knees', label: t('onboarding.step5.knees') },
    { value: 'shoulders', label: t('onboarding.step5.shoulders') },
  ];

  const MEALS_OPTIONS = [
    { value: 'TwoToThree', label: t('onboarding.step6.twoToThree') },
    { value: 'FourToFive', label: t('onboarding.step6.fourToFive') },
    { value: 'SixPlus', label: t('onboarding.step6.sixPlus') },
  ];

  const DIET_STYLES = [
    { value: 'Standard', label: t('onboarding.step6.standard') },
    { value: 'Vegetarian', label: t('onboarding.step6.vegetarian') },
    { value: 'Vegan', label: t('onboarding.step6.vegan') },
    { value: 'GlutenFree', label: t('onboarding.step6.glutenFree') },
  ];

  const ALLERGY_OPTIONS = [
    { value: 'none', label: t('onboarding.step6.noAllergies') },
    { value: 'lactose', label: t('onboarding.step6.lactose') },
    { value: 'gluten', label: t('onboarding.step6.gluten') },
    { value: 'nuts', label: t('onboarding.step6.nuts') },
  ];

  const PLAN_EXP = [
    { value: 'Never', label: t('onboarding.step7.never') },
    { value: 'TriedFailed', label: t('onboarding.step7.triedFailed') },
    { value: 'TriedSucceeded', label: t('onboarding.step7.triedSucceeded') },
  ];

  const BLOCKER_OPTIONS = [
    { value: 'time', label: t('onboarding.step7.lackOfTime') },
    { value: 'motivation', label: t('onboarding.step7.lostMotivation') },
    { value: 'knowledge', label: t('onboarding.step7.didntKnow') },
    { value: 'slow_results', label: t('onboarding.step7.slowResults') },
    { value: 'none', label: t('onboarding.step7.nothingHeldBack') },
  ];

  const MOTIVATIONS = [
    { value: 'Appearance', label: t('onboarding.step7.appearance') },
    { value: 'Health', label: t('onboarding.step7.healthEnergy') },
    { value: 'Performance', label: t('onboarding.step7.performance') },
    { value: 'Confidence', label: t('onboarding.step7.confidence') },
  ];

  const set = (key: keyof FormData, value: FormData[keyof FormData]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleMulti = (key: 'preferredActivities' | 'injuries' | 'allergies' | 'pastBlockers', value: string) => {
    setForm(prev => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const addCustomItem = (key: 'preferredActivities' | 'injuries' | 'allergies', value: string, clearFn: (v: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setForm(prev => {
      const arr = prev[key] as string[];
      if (arr.includes(trimmed)) return prev;
      return { ...prev, [key]: [...arr, trimmed] };
    });
    clearFn('');
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!form.age && !!form.sex && !!form.heightCm && !!form.weightKg && !!form.bodyType;
      case 2: return !!form.primaryGoal && !!form.timeHorizon;
      case 3: return !!form.jobType && form.sleepHours > 0 && form.stressLevel > 0;
      case 4: return !!form.currentTrainingFrequency && !!form.desiredTrainingFrequency && form.fitnessRating > 0;
      case 5: return true;
      case 6: return !!form.mealsPerDay && !!form.dietaryStyle;
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

        preferredActivities: form.preferredActivities,
        injuries: form.injuries,
        mealsPerDay: form.mealsPerDay,
        dietaryStyle: form.dietaryStyle,
        allergies: form.allergies,

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
      Alert.alert(t('onboarding.errorTitle'), t('onboarding.errorMessage'));
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

  const DropdownSelect = ({ value, placeholder, options, onSelect }: {
    value: string; placeholder: string;
    options: { value: string; label: string }[];
    onSelect: (v: string) => void;
  }) => {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.value === value);
    return (
      <>
        <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Text style={[styles.dropdownText, !selected && styles.dropdownPlaceholder]}>
            {selected?.label ?? placeholder}
          </Text>
          <Text style={styles.dropdownArrow}>▾</Text>
        </TouchableOpacity>
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
            <View style={styles.dropdownMenu}>
              {options.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.dropdownItem, value === o.value && styles.dropdownItemSelected]}
                  onPress={() => { onSelect(o.value); setOpen(false); }}
                >
                  <Text style={[styles.dropdownItemText, value === o.value && styles.optionLabelSelected]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </>
    );
  };

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
          <Text style={styles.stepTitle}>{t('onboarding.step1.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step1.subtitle')}</Text>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('onboarding.step1.age')}</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={form.age}
                onChangeText={v => set('age', v)} placeholder="25" placeholderTextColor={Colors.dark.muted} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('onboarding.step1.sex')}</Text>
              <DropdownSelect
                value={form.sex}
                placeholder={t('onboarding.step1.sexSelect')}
                options={[{ value: 'Male', label: t('onboarding.step1.male') }, { value: 'Female', label: t('onboarding.step1.female') }]}
                onSelect={v => set('sex', v)}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('onboarding.step1.height')}</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={form.heightCm}
                onChangeText={v => set('heightCm', v)} placeholder="175" placeholderTextColor={Colors.dark.muted} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('onboarding.step1.weight')}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={form.weightKg}
                onChangeText={v => set('weightKg', v)} placeholder="75" placeholderTextColor={Colors.dark.muted} />
            </View>
          </View>
          <Text style={styles.label}>{t('onboarding.step1.targetWeight')}</Text>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={form.targetWeightKg}
            onChangeText={v => set('targetWeightKg', v)} placeholder="70" placeholderTextColor={Colors.dark.muted} />
          <Text style={styles.label}>{t('onboarding.step1.bodyType')}</Text>
          <View style={{ gap: 8 }}>
            {BODY_TYPES.map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub}
                selected={form.bodyType === o.value} onPress={() => set('bodyType', o.value)} />
            ))}
          </View>
        </>
      );
      case 2: return (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.step2.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step2.subtitle')}</Text>
          <Text style={styles.label}>{t('onboarding.step2.goalLabel')}</Text>
          <View style={{ gap: 8 }}>
            {GOALS.map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub}
                selected={form.primaryGoal === o.value} onPress={() => set('primaryGoal', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step2.timeHorizon')}</Text>
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
          <Text style={styles.stepTitle}>{t('onboarding.step3.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step3.subtitle')}</Text>
          <Text style={styles.label}>{t('onboarding.step3.jobType')}</Text>
          <View style={{ gap: 8 }}>
            {JOB_TYPES.map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub}
                selected={form.jobType === o.value} onPress={() => set('jobType', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step3.sleep')}</Text>
          <View style={styles.sleepRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.sleepBtn, form.sleepHours === n && styles.sleepBtnSelected]}
                onPress={() => set('sleepHours', n)}
              >
                <Text style={[styles.sleepBtnText, form.sleepHours === n && styles.sleepBtnTextSelected]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>1{t('onboarding.step3.sleepUnit')}</Text>
            <Text style={styles.scaleLabelText}>10{t('onboarding.step3.sleepUnit')}</Text>
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step3.stressLevel')}</Text>
          <ScaleRow count={5} value={form.stressLevel} onSelect={n => set('stressLevel', n)} />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>{t('onboarding.step3.noStress')}</Text>
            <Text style={styles.scaleLabelText}>{t('onboarding.step3.extremeStress')}</Text>
          </View>
        </>
      );
      case 4: return (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.step4.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step4.subtitle')}</Text>
          <Text style={styles.label}>{t('onboarding.step4.currentFreq')}</Text>
          <View style={styles.row}>
            {CURRENT_FREQ.map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub}
                selected={form.currentTrainingFrequency === o.value}
                onPress={() => set('currentTrainingFrequency', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step4.desiredFreq')}</Text>
          <View style={styles.row}>
            {DESIRED_FREQ.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.desiredTrainingFrequency === o.value}
                onPress={() => set('desiredTrainingFrequency', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step4.fitnessLevel')}</Text>
          <ScaleRow count={10} value={form.fitnessRating} onSelect={n => set('fitnessRating', n)} />
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>{t('onboarding.step4.veryPoor')}</Text>
            <Text style={styles.scaleLabelText}>{t('onboarding.step4.athlete')}</Text>
          </View>
        </>
      );
      case 5: return (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.step5.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step5.subtitle')}</Text>
          <Text style={styles.label}>{t('onboarding.step5.activities')}</Text>
          <View style={styles.grid}>
            {ACTIVITIES.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.preferredActivities.includes(o.value)}
                onPress={() => toggleMulti('preferredActivities', o.value)} />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={customActivity}
            onChangeText={setCustomActivity}
            placeholder={t('onboarding.step5.addCustomActivity')}
            placeholderTextColor={Colors.dark.muted}
            onSubmitEditing={() => addCustomItem('preferredActivities', customActivity, setCustomActivity)}
            returnKeyType="done"
          />
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step5.injuries')}</Text>
          <View style={styles.grid}>
            {INJURY_OPTIONS.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.injuries.includes(o.value)}
                onPress={() => toggleMulti('injuries', o.value)} />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={customInjury}
            onChangeText={setCustomInjury}
            placeholder={t('onboarding.step5.addCustomInjury')}
            placeholderTextColor={Colors.dark.muted}
            onSubmitEditing={() => addCustomItem('injuries', customInjury, setCustomInjury)}
            returnKeyType="done"
          />
        </>
      );
      case 6: return (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.step6.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step6.subtitle')}</Text>
          <Text style={styles.label}>{t('onboarding.step6.mealsPerDay')}</Text>
          <View style={styles.row}>
            {MEALS_OPTIONS.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.mealsPerDay === o.value} onPress={() => set('mealsPerDay', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step6.dietaryStyle')}</Text>
          <View style={styles.grid}>
            {DIET_STYLES.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.dietaryStyle === o.value} onPress={() => set('dietaryStyle', o.value)} />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={customDiet}
            onChangeText={setCustomDiet}
            placeholder={t('onboarding.step6.addCustomDiet')}
            placeholderTextColor={Colors.dark.muted}
            onSubmitEditing={() => {
              const trimmed = customDiet.trim();
              if (trimmed) { set('dietaryStyle', trimmed); setCustomDiet(''); }
            }}
            returnKeyType="done"
          />
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step6.allergies')}</Text>
          <View style={styles.grid}>
            {ALLERGY_OPTIONS.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.allergies.includes(o.value)}
                onPress={() => toggleMulti('allergies', o.value)} />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={customAllergy}
            onChangeText={setCustomAllergy}
            placeholder={t('onboarding.step6.addCustomAllergy')}
            placeholderTextColor={Colors.dark.muted}
            onSubmitEditing={() => addCustomItem('allergies', customAllergy, setCustomAllergy)}
            returnKeyType="done"
          />
        </>
      );
      case 7: return (
        <>
          <Text style={styles.stepTitle}>{t('onboarding.step7.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step7.subtitle')}</Text>
          <Text style={styles.label}>{t('onboarding.step7.planExperience')}</Text>
          <View style={{ gap: 8 }}>
            {PLAN_EXP.map(o => (
              <OptionCard key={o.value} label={o.label}
                selected={form.planExperience === o.value} onPress={() => set('planExperience', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step7.blockers')}</Text>
          <View style={styles.grid}>
            {BLOCKER_OPTIONS.map(o => (
              <CheckboxItem key={o.value} label={o.label}
                selected={form.pastBlockers.includes(o.value)}
                onPress={() => toggleMulti('pastBlockers', o.value)} />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.step7.motivation')}</Text>
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

  const lookup = (options: { value: string; label: string }[], val: string) =>
    options.find(o => o.value === val)?.label ?? val;

  const lookupMulti = (options: { value: string; label: string }[], vals: string[]) =>
    vals.map(v => options.find(o => o.value === v)?.label ?? v).join(', ');

  const sexLabel = (v: string) => v === 'Male' ? t('onboarding.step1.male') : v === 'Female' ? t('onboarding.step1.female') : v;

  const summaryRows = (): { label: string; value: string }[] => [
    { label: t('onboarding.summary.age'), value: form.age },
    { label: t('onboarding.summary.sex'), value: sexLabel(form.sex) },
    { label: t('onboarding.summary.height'), value: `${form.heightCm} cm` },
    { label: t('onboarding.summary.weight'), value: `${form.weightKg} kg` },
    ...(form.targetWeightKg ? [{ label: t('onboarding.summary.targetWeight'), value: `${form.targetWeightKg} kg` }] : []),
    { label: t('onboarding.summary.bodyType'), value: lookup(BODY_TYPES, form.bodyType) },
    { label: t('onboarding.summary.goal'), value: lookup(GOALS, form.primaryGoal) },
    { label: t('onboarding.summary.timeHorizon'), value: lookup(TIME_HORIZONS, form.timeHorizon) },
    { label: t('onboarding.summary.jobType'), value: lookup(JOB_TYPES, form.jobType) },
    { label: t('onboarding.summary.sleep'), value: `${form.sleepHours}${t('onboarding.step3.sleepUnit')}` },
    { label: t('onboarding.summary.stress'), value: `${form.stressLevel}/5` },
    { label: t('onboarding.summary.currentTraining'), value: lookup(CURRENT_FREQ, form.currentTrainingFrequency) },
    { label: t('onboarding.summary.desiredTraining'), value: lookup(DESIRED_FREQ, form.desiredTrainingFrequency) },
    { label: t('onboarding.summary.fitnessLevel'), value: `${form.fitnessRating}/10` },
    ...(form.preferredActivities.length ? [{ label: t('onboarding.summary.activities'), value: lookupMulti(ACTIVITIES, form.preferredActivities) }] : []),
    ...(form.injuries.length ? [{ label: t('onboarding.summary.injuries'), value: lookupMulti(INJURY_OPTIONS, form.injuries) }] : []),
    { label: t('onboarding.summary.mealsPerDay'), value: lookup(MEALS_OPTIONS, form.mealsPerDay) },
    { label: t('onboarding.summary.dietStyle'), value: lookup(DIET_STYLES, form.dietaryStyle) },
    ...(form.allergies.length ? [{ label: t('onboarding.summary.allergies'), value: lookupMulti(ALLERGY_OPTIONS, form.allergies) }] : []),

    { label: t('onboarding.summary.planExperience'), value: lookup(PLAN_EXP, form.planExperience) },
    ...(form.pastBlockers.length ? [{ label: t('onboarding.summary.pastBlockers'), value: lookupMulti(BLOCKER_OPTIONS, form.pastBlockers) }] : []),
    { label: t('onboarding.summary.motivation'), value: lookup(MOTIVATIONS, form.primaryMotivation) },
  ];

  const isSummary = step > TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: isSummary ? '100%' : `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      {isSummary && (
        <View style={styles.summaryHeader}>
          <Text style={styles.stepTitle}>{t('onboarding.summary.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.summary.subtitle')}</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isSummary && <Text style={styles.stepLabel}>{t('onboarding.stepOf', { step, total: TOTAL_STEPS })}</Text>}
        {isSummary ? (
          <View style={styles.summaryCard}>
            {summaryRows().map(({ label, value }) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{label}</Text>
                <Text style={styles.summaryValue}>{value}</Text>
              </View>
            ))}
          </View>
        ) : renderStep()}
      </ScrollView>

      <View style={styles.nav}>
        <Text style={styles.navInfo}>{isSummary ? t('onboarding.readyToSubmit') : t('onboarding.stepOf', { step, total: TOTAL_STEPS })}</Text>
        <View style={styles.btnRow}>
          {(step > 1 || isSummary) && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backBtnText}>{t('onboarding.back')}</Text>
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
                <Text style={styles.nextBtnText}>{t('onboarding.submit')}</Text>
              )}
            </TouchableOpacity>
          ) : step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance() && styles.btnDisabled]}
              onPress={() => canAdvance() && setStep(s => s + 1)}
              disabled={!canAdvance()}>
              <Text style={styles.nextBtnText}>{t('onboarding.continue')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance() && styles.btnDisabled]}
              onPress={() => {
                if (!canAdvance()) return;
                // Flush any pending custom input values
                if (customActivity.trim()) { addCustomItem('preferredActivities', customActivity, setCustomActivity); }
                if (customInjury.trim()) { addCustomItem('injuries', customInjury, setCustomInjury); }
                if (customAllergy.trim()) { addCustomItem('allergies', customAllergy, setCustomAllergy); }
                if (customDiet.trim()) { set('dietaryStyle', customDiet.trim()); setCustomDiet(''); }
                setStep(TOTAL_STEPS + 1);
              }}
              disabled={!canAdvance()}>
              <Text style={styles.nextBtnText}>{t('onboarding.review')}</Text>
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
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.dark.surface,
    minWidth: 80, flexBasis: '48%', flexGrow: 1,
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
    flexBasis: '48%', flexGrow: 1,
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
  sleepRow: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  sleepBtn: {
    flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: Colors.dark.border,
    borderRadius: 4, alignItems: 'center', backgroundColor: Colors.dark.surface,
  },
  sleepBtnSelected: { borderColor: Colors.dark.gold, backgroundColor: 'rgba(201,168,76,0.08)' },
  sleepBtnText: { fontSize: 12, color: Colors.dark.muted },
  sleepBtnTextSelected: { color: Colors.dark.gold, fontWeight: '600' },
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
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border,
    borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
  },
  dropdownText: { fontSize: 15, color: Colors.dark.text },
  dropdownPlaceholder: { color: Colors.dark.muted },
  dropdownArrow: { fontSize: 14, color: Colors.dark.muted },
  dropdownOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dropdownMenu: {
    backgroundColor: Colors.dark.surface, borderRadius: 8, borderWidth: 1,
    borderColor: Colors.dark.border, minWidth: 200, overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 20, paddingVertical: 14 },
  dropdownItemSelected: { backgroundColor: 'rgba(201,168,76,0.08)' },
  dropdownItemText: { fontSize: 15, color: Colors.dark.text },
  summaryHeader: { paddingHorizontal: 24, paddingTop: 24 },
  summaryCard: {
    backgroundColor: Colors.dark.surface, borderRadius: 8, padding: 16, marginBottom: 16,
  },
  summaryRow: {
    paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: Colors.dark.border,
  },
  summaryLabel: { fontSize: 12, color: Colors.dark.muted, marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: '500', color: Colors.dark.text },
});
