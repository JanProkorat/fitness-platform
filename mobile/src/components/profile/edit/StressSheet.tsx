import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIMITS } from '@/api/onboarding';
import { Button } from '@/components/Button';
import { FieldLabel } from '@/components/onboarding/FieldLabel';
import { RatingEnds } from '@/components/onboarding/RatingEnds';
import { RatingScale } from '@/components/onboarding/RatingScale';
import { SheetCancel, SheetFrame } from '@/components/profile/edit/SheetFrame';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type StressSheetProps = {
  visible: boolean;
  title: string;
  /** The stored stress level, 1-5, or `null` when there is none yet. */
  value: number | null;
  onSave: (value: number) => void;
  onClose: () => void;
};

const NO_READOUT = ' ';

/** Bottom sheet with the onboarding 1-5 stress scale. */
export function StressSheet({ visible, ...rest }: StressSheetProps) {
  // A fresh content tree per opening, so the scale starts from the current value.
  return visible ? <OpenSheet {...rest} /> : null;
}

function OpenSheet({ title, value, onSave, onClose }: Omit<StressSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [draft, setDraft] = useState(value);

  return (
    <SheetFrame visible title={title} onClose={onClose} action={<SheetCancel onPress={onClose} />}>
      <View>
        <FieldLabel
          label={t('onboarding.lifestyle.stress')}
          readout={draft === null ? NO_READOUT : t(`onboarding.lifestyle.stressWords.${draft}`)}
        />
        <View style={styles.scale}>
          <RatingScale
            min={LIMITS.stress.min}
            max={LIMITS.stress.max}
            value={draft}
            onChange={setDraft}
            accessibilityLabel={t('onboarding.lifestyle.stress')}
          />
        </View>
        <RatingEnds
          low={t(`onboarding.lifestyle.stressWords.${LIMITS.stress.min}`)}
          high={t(`onboarding.lifestyle.stressWords.${LIMITS.stress.max}`)}
        />
      </View>
      <Button
        label={t('onboarding.sheet.done')}
        disabled={draft === null}
        onPress={() => {
          if (draft === null) return;
          onSave(draft);
          onClose();
        }}
      />
    </SheetFrame>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scale: {
      paddingTop: theme.spacing.xs,
    },
  });
