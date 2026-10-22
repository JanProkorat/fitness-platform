import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import Reanimated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import type { MeasurementEntry } from '@/api/measurements';
import type { AddMeasurementRequest } from '@/api/generated';
import { Button } from '@/components/Button';
import { ListCard } from '@/components/profile/ListCard';
import { Text } from '@/components/Text';
import { useAddMeasurement } from '@/hooks/useAddMeasurement';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { measuredAtPickerMotion, sheetDragMotion } from '@/theme/motion';

import { lastHintLabel } from './format';
import { MeasuredAtRow } from './MeasuredAtRow';
import { MetricInput } from './MetricInput';
import { METRICS, latestValue, parseMetricInput } from './metrics';
import type { Metric, MetricKey } from './metrics';

const NOTE_MAX_LENGTH = 500;

type FormValues = Record<MetricKey, string>;

const EMPTY_FORM: FormValues = {
  weight: '',
  waist: '',
  hips: '',
  chest: '',
  biceps: '',
  thigh: '',
  bodyFat: '',
};

/** Moves the blocks below the date picker smoothly when it opens or closes. */
const reflow = LinearTransition.duration(measuredAtPickerMotion.layoutDuration).reduceMotion(
  ReduceMotion.System,
);

const unitSymbol = (t: TFunction, metric: Metric): string => t(`measurements.symbols.${metric.unit}`);

type AddMeasurementSheetProps = {
  visible: boolean;
  /** The history, newest first; feeds the "Last ..." hints. */
  entries: readonly MeasurementEntry[];
  onClose: () => void;
};

type SheetContentProps = Omit<AddMeasurementSheetProps, 'visible'> & {
  /** Filled by the content with its close handler so the Modal's back request shares it. */
  closeRef: MutableRefObject<() => void>;
};

export function AddMeasurementSheet({ visible, entries, onClose }: AddMeasurementSheetProps) {
  const closeRef = useRef<() => void>(onClose);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => closeRef.current()}
    >
      <SheetContent entries={entries} onClose={onClose} closeRef={closeRef} />
    </Modal>
  );
}

const CIRCUMFERENCES = METRICS.filter((metric) => metric.unit === 'cm');
const WEIGHT = METRICS.find((metric) => metric.key === 'weight');
const BODY_FAT = METRICS.find((metric) => metric.key === 'bodyFat');

function SheetContent({ entries, onClose, closeRef }: SheetContentProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const styles = makeStyles(theme, insets, keyboardVisible);
  const [translateY] = useState(() => new Animated.Value(0));
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const [measuredAt, setMeasuredAt] = useState(() => new Date());
  const mutation = useAddMeasurement();

  const parsed = METRICS.map((metric) => ({ metric, input: parseMetricInput(values[metric.key]) }));
  const filled = parsed.filter((entry) => entry.input.state !== 'empty');
  const hasInvalid = filled.some((entry) => entry.input.state === 'invalid');
  const canSave = filled.length > 0 && !hasInvalid && !mutation.isPending;

  const dirty = Object.values(values).some((text) => text !== '') || note !== '';
  const pending = mutation.isPending;

  const springBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      ...sheetDragMotion.spring,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const requestClose = useCallback(() => {
    if (pending) {
      springBack();
      return;
    }
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(
      t('editProfile.discard.title'),
      t('editProfile.discard.body'),
      [
        { text: t('editProfile.discard.keep'), style: 'cancel', onPress: springBack },
        { text: t('editProfile.discard.discard'), style: 'destructive', onPress: onClose },
      ],
      { onDismiss: springBack },
    );
  }, [pending, dirty, onClose, springBack, t]);

  useEffect(() => {
    closeRef.current = requestClose;
  }, [closeRef, requestClose]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > sheetDragMotion.claimDistance && gesture.dy > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > sheetDragMotion.closeDistance || gesture.vy > sheetDragMotion.closeVelocity) {
            requestClose();
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: springBack,
      }),
    [translateY, requestClose, springBack],
  );

  const setValue = (key: MetricKey) => (text: string) => {
    setValues((current) => ({ ...current, [key]: text }));
    if (mutation.isError) mutation.reset();
  };

  const save = () => {
    if (!canSave) return;
    const request: AddMeasurementRequest = {
      measuredAt: measuredAt.toISOString(),
      notes: note.trim() === '' ? undefined : note.trim(),
    };
    for (const { metric, input } of parsed) {
      if (input.state === 'ok') request[metric.field] = input.value;
    }
    mutation.mutate(request, { onSuccess: onClose });
  };

  const renderInput = (metric: Metric, variant: 'hero' | 'row', autoFocus?: boolean) => {
    const text = values[metric.key];
    return (
      <MetricInput
        key={metric.key}
        label={t(`measurements.metrics.${metric.key}`)}
        unit={unitSymbol(t, metric)}
        hint={lastHintLabel(t, i18n.language, metric.unit, latestValue(entries, metric))}
        value={text}
        onChangeText={setValue(metric.key)}
        invalid={parseMetricInput(text).state === 'invalid'}
        variant={variant}
        autoFocus={autoFocus}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('measurements.sheet.close')}
        onPress={requestClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={t('measurements.add')}
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        <View {...panResponder.panHandlers} style={styles.dragStrip}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text variant="heading" accessibilityRole="header">
                {t('measurements.add')}
              </Text>
              <Text variant="caption" color="muted">
                {t('measurements.sheet.subtitle')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('measurements.sheet.close')}
              onPress={requestClose}
              hitSlop={theme.spacing.xs}
              style={styles.close}
            >
              <SymbolView
                name="xmark"
                tintColor={theme.colors.ink}
                size={theme.sizes.sheetCloseGlyph}
              />
            </Pressable>
          </View>
        </View>
        {mutation.isError ? (
          <Text variant="label" color="error" accessibilityRole="alert">
            {t('measurements.sheet.error')}
          </Text>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <MeasuredAtRow value={measuredAt} onChange={setMeasuredAt} />
          <Reanimated.View layout={reflow} style={styles.heroes}>
            {WEIGHT ? renderInput(WEIGHT, 'hero', true) : null}
            {BODY_FAT ? renderInput(BODY_FAT, 'hero') : null}
          </Reanimated.View>
          <Reanimated.View layout={reflow} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text variant="label" color="muted">
                {t('measurements.sheet.circumference')}
              </Text>
              <Text variant="label" color="muted">
                {t('measurements.symbols.cm')}
              </Text>
            </View>
            <ListCard>
              {CIRCUMFERENCES.map((metric) => renderInput(metric, 'row'))}
            </ListCard>
          </Reanimated.View>
          <Reanimated.View layout={reflow} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text variant="label" color="muted">
                {t('measurements.sheet.note')}
              </Text>
              <View style={styles.optional}>
                <Text variant="chipSmall" color="muted">
                  {t('measurements.sheet.optional')}
                </Text>
              </View>
            </View>
            <TextInput
              value={note}
              onChangeText={(text) => {
                setNote(text);
                if (mutation.isError) mutation.reset();
              }}
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
              accessibilityLabel={t('measurements.sheet.note')}
              placeholder={t('measurements.sheet.notePlaceholder')}
              placeholderTextColor={theme.colors.muted}
              selectionColor={theme.colors.accent}
              maxLength={NOTE_MAX_LENGTH}
              multiline
              textAlignVertical="top"
              style={[
                styles.note,
                { borderColor: noteFocused ? theme.colors.ink : 'transparent' },
              ]}
            />
          </Reanimated.View>
        </ScrollView>
        <View style={styles.footer}>
          <Button label={t('measurements.sheet.save')} onPress={save} disabled={!canSave} />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme, insets: EdgeInsets, keyboardVisible: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.glass.sheet.backdrop[theme.scheme],
    },
    sheet: {
      flex: 1,
      marginTop: theme.sizes.measureSheetTop,
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
      borderTopLeftRadius: theme.glass.sheet.radius,
      borderTopRightRadius: theme.glass.sheet.radius,
      backgroundColor: theme.colors.surface,
    },
    dragStrip: {
      gap: theme.spacing.lg,
    },
    handle: {
      alignSelf: 'center',
      width: theme.glass.sheet.handleWidth,
      height: theme.glass.sheet.handleHeight,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.lineStrong,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    headerCopy: {
      flex: 1,
      gap: theme.spacing.xxs / 2,
    },
    close: {
      width: theme.sizes.sheetClose,
      height: theme.sizes.sheetClose,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lineStrong,
    },
    footer: {
      paddingTop: theme.spacing.xs,
      paddingBottom: keyboardVisible ? theme.spacing.xs : Math.max(insets.bottom, theme.spacing.xl),
    },
    body: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    heroes: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    group: {
      gap: theme.spacing.xs,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optional: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs / 2,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    note: {
      ...theme.typography.body,
      height: theme.sizes.metricNoteField,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.borderStrong,
      backgroundColor: theme.colors.field,
      color: theme.colors.ink,
    },
  });
