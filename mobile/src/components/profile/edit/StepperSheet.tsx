import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Stepper } from '@/components/onboarding/Stepper';
import { SheetCancel, SheetFrame } from '@/components/profile/edit/SheetFrame';

type StepperSheetProps = {
  visible: boolean;
  title: string;
  unit: string;
  /** The stored value, or `null` when there is none yet. */
  value: number | null;
  /** The number shown when there is no stored value. */
  start: number;
  min: number;
  max: number;
  step: number;
  /** Cleans a stepped value, for example by rounding it to one decimal. */
  normalize?: (value: number) => number;
  onSave: (value: number) => void;
  onClose: () => void;
};

/** Bottom sheet with the onboarding stepper, for a number changed in small steps. */
export function StepperSheet({ visible, ...rest }: StepperSheetProps) {
  // A fresh content tree per opening, so the stepper starts from the current value.
  return visible ? <OpenSheet {...rest} /> : null;
}

function OpenSheet({
  title,
  unit,
  value,
  start,
  min,
  max,
  step,
  normalize = (stepped) => stepped,
  onSave,
  onClose,
}: Omit<StepperSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value ?? start);

  const clamp = (next: number) => Math.min(max, Math.max(min, normalize(next)));

  return (
    <SheetFrame visible title={title} onClose={onClose} action={<SheetCancel onPress={onClose} />}>
      <Stepper
        label={title}
        display={String(draft)}
        unit={unit}
        canDecrease={draft > min}
        canIncrease={draft < max}
        onDecrease={() => setDraft(clamp(draft - step))}
        onIncrease={() => setDraft(clamp(draft + step))}
      />
      <Button
        label={t('onboarding.sheet.done')}
        onPress={() => {
          onSave(draft);
          onClose();
        }}
      />
    </SheetFrame>
  );
}
