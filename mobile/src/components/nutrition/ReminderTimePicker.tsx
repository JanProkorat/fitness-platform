import React, { useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import type { ReminderTime } from '@/lib/reminderScheduler';

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface ReminderTimePickerProps {
  visible: boolean;
  initialTime: ReminderTime;
  onConfirm: (time: ReminderTime) => void;
  onDismiss: () => void;
}

/**
 * A platform-native-styled time picker implemented with ScrollView wheels.
 * Does not require @react-native-community/datetimepicker.
 *
 * On iOS the native date picker UX is closely approximated; on Android
 * the same scroll-wheel approach is used for consistency.
 */
export function ReminderTimePicker({
  visible,
  initialTime,
  onConfirm,
  onDismiss,
}: ReminderTimePickerProps): React.ReactElement {
  const { t } = useTranslation();
  const colors = useTheme();

  const [selectedHour, setSelectedHour] = useState(initialTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(initialTime.minute);

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // When modal becomes visible, scroll to initial position.
  const handleShowModal = useCallback(() => {
    setSelectedHour(initialTime.hour);
    setSelectedMinute(initialTime.minute);
    // Defer scroll so layout is complete before scrollTo fires.
    setTimeout(() => {
      hourScrollRef.current?.scrollTo({
        y: initialTime.hour * ITEM_HEIGHT,
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: initialTime.minute * ITEM_HEIGHT,
        animated: false,
      });
    }, 50);
  }, [initialTime.hour, initialTime.minute]);

  const handleConfirm = useCallback(() => {
    onConfirm({ hour: selectedHour, minute: selectedMinute });
  }, [selectedHour, selectedMinute, onConfirm]);

  const handleHourScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      setSelectedHour(Math.max(0, Math.min(23, index)));
    },
    [],
  );

  const handleMinuteScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      setSelectedMinute(Math.max(0, Math.min(59, index)));
    },
    [],
  );

  const styles = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      onShow={handleShowModal}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onDismiss}
        accessible={false}
      >
        <View
          style={styles.sheet}
          // Prevent touches on the sheet from bubbling to the overlay.
          onStartShouldSetResponder={() => true}
        >
          {/* Title */}
          <Text style={styles.title}>
            {t('nutrition.supplements.reminderTime.picker.title')}
          </Text>

          {/* Wheels */}
          <View style={styles.wheelsRow}>
            {/* Hour wheel */}
            <View style={styles.wheelContainer}>
              <Text style={styles.wheelLabel}>{pad2(selectedHour)}</Text>
              <ScrollView
                ref={hourScrollRef}
                style={styles.wheel}
                contentContainerStyle={styles.wheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleHourScroll}
                onScrollEndDrag={handleHourScroll}
                scrollEventThrottle={16}
                accessibilityLabel={t('nutrition.supplements.reminderTime.picker.title')}
              >
                {/* Padding items so first/last value can center */}
                <View style={styles.wheelPadding} />
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.wheelItem,
                      h === selectedHour && styles.wheelItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedHour(h);
                      hourScrollRef.current?.scrollTo({
                        y: h * ITEM_HEIGHT,
                        animated: true,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.wheelItemText,
                        { color: h === selectedHour ? colors.gold : colors.label2 },
                        h === selectedHour && styles.wheelItemTextSelected,
                      ]}
                    >
                      {pad2(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.wheelPadding} />
              </ScrollView>
            </View>

            <Text style={[styles.colonSeparator, { color: colors.label }]}>:</Text>

            {/* Minute wheel */}
            <View style={styles.wheelContainer}>
              <Text style={styles.wheelLabel}>{pad2(selectedMinute)}</Text>
              <ScrollView
                ref={minuteScrollRef}
                style={styles.wheel}
                contentContainerStyle={styles.wheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMinuteScroll}
                onScrollEndDrag={handleMinuteScroll}
                scrollEventThrottle={16}
              >
                <View style={styles.wheelPadding} />
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.wheelItem,
                      m === selectedMinute && styles.wheelItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedMinute(m);
                      minuteScrollRef.current?.scrollTo({
                        y: m * ITEM_HEIGHT,
                        animated: true,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.wheelItemText,
                        { color: m === selectedMinute ? colors.gold : colors.label2 },
                        m === selectedMinute && styles.wheelItemTextSelected,
                      ]}
                    >
                      {pad2(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.wheelPadding} />
              </ScrollView>
            </View>
          </View>

          {/* Actions */}
          <View style={[styles.actionsRow, { borderTopColor: colors.sep }]}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onDismiss}
              accessibilityRole="button"
            >
              <Text style={[styles.actionBtnText, { color: colors.label3 }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleConfirm}
              accessibilityRole="button"
            >
              <Text style={[styles.actionBtnText, { color: colors.gold }]}>
                {t('common.continue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default ReminderTimePicker;

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>;

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bg2,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 32,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.label,
      textAlign: 'center',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.sep,
    },
    wheelsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 12,
    },
    wheelContainer: {
      width: 72,
      height: PICKER_HEIGHT,
    },
    wheelLabel: {
      // Hidden — the label lives inside scroll items; this is just for a11y reference.
      height: 0,
      opacity: 0,
    },
    wheel: {
      height: PICKER_HEIGHT,
    },
    wheelContent: {
      // no extra paddingVertical here; padding items handle centering
    },
    wheelPadding: {
      height: ITEM_HEIGHT * 2,
    },
    wheelItem: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelItemSelected: {
      // Subtle highlight for the selected item.
    },
    wheelItemText: {
      fontSize: 22,
      fontVariant: ['tabular-nums'],
    },
    wheelItemTextSelected: {
      fontWeight: '700',
    },
    colonSeparator: {
      fontSize: 28,
      fontWeight: '700',
      marginHorizontal: 12,
      marginTop: -6,
    },
    actionsRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: 8,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
    },
    actionBtnText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
