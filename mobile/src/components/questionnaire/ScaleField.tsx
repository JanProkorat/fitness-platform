import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RatingEnds } from '@/components/onboarding/RatingEnds';
import { RatingScale } from '@/components/onboarding/RatingScale';
import type { FieldProps } from '@/components/questionnaire/fieldProps';

/** scale: a track of numbered pills from the question's lowest to highest value. */
export function ScaleField({ question, draft, onChange }: FieldProps) {
  const { t } = useTranslation();
  const min = question.min ?? 1;
  const max = question.max ?? 10;

  return (
    <View>
      <RatingScale
        min={min}
        max={max}
        value={draft.number}
        onChange={(number) => onChange({ number })}
        accessibilityLabel={question.label}
      />
      <RatingEnds low={t('questionnaireFill.scale.low')} high={t('questionnaireFill.scale.high')} />
    </View>
  );
}
