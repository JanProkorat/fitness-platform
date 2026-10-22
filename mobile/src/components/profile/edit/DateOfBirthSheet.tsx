import { useState } from 'react';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { dateOfBirthBounds, formatDateOnly, parseDateOnly } from '@/api/onboardingAnswers';
import { Button } from '@/components/Button';
import { SheetCancel, SheetFrame } from '@/components/profile/edit/SheetFrame';
import { useTheme } from '@/theme';

/** The day the picker opens on: the stored date of birth, else a typical adult, kept inside the age range. */
function pickerStart(value: string | null): Date {
  const { min, max } = dateOfBirthBounds();
  const today = new Date();
  const stored = value === null ? null : parseDateOnly(value);
  const start = stored ?? new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
  if (start.getTime() < min.getTime()) return min;
  return start.getTime() > max.getTime() ? max : start;
}

/** Opens the native Android date dialog, limited to ages 13-100; `onPick` gets the chosen local date. */
export function openDateOfBirthDialog(value: string | null, onPick: (picked: Date) => void) {
  const { min, max } = dateOfBirthBounds();
  DateTimePickerAndroid.open({
    value: pickerStart(value),
    mode: 'date',
    minimumDate: min,
    maximumDate: max,
    onValueChange: (_event, picked) => onPick(picked),
  });
}

type DateOfBirthSheetProps = {
  visible: boolean;
  title: string;
  /** The stored date of birth as `YYYY-MM-DD`, or `null`. */
  value: string | null;
  /** Called with the chosen day as `YYYY-MM-DD`. */
  onSave: (value: string) => void;
  onClose: () => void;
};

/** iOS bottom sheet with a date-only wheel; Android uses `openDateOfBirthDialog` instead. */
export function DateOfBirthSheet({ visible, ...rest }: DateOfBirthSheetProps) {
  // A fresh content tree per opening, so the wheel starts from the current value.
  return visible ? <OpenSheet {...rest} /> : null;
}

function OpenSheet({ title, value, onSave, onClose }: Omit<DateOfBirthSheetProps, 'visible'>) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [draft, setDraft] = useState(() => pickerStart(value));
  const { min, max } = dateOfBirthBounds();

  return (
    <SheetFrame visible title={title} onClose={onClose} action={<SheetCancel onPress={onClose} />}>
      <DateTimePicker
        value={draft}
        mode="date"
        display="spinner"
        minimumDate={min}
        maximumDate={max}
        locale={i18n.language}
        themeVariant={theme.scheme}
        accentColor={theme.colors.accent}
        onValueChange={(_event, picked) => setDraft(picked)}
      />
      <Button
        label={t('onboarding.sheet.done')}
        onPress={() => {
          onSave(formatDateOnly(draft));
          onClose();
        }}
      />
    </SheetFrame>
  );
}
