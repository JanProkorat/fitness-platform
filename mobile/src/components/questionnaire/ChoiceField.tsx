import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/Input';
import { Segmented } from '@/components/onboarding/Segmented';
import type { SegmentOption } from '@/components/onboarding/Segmented';
import { OptionRow } from '@/components/questionnaire/OptionRow';
import type { FieldProps } from '@/components/questionnaire/fieldProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const OTHER_MAX_LENGTH = 500;
const COMPACT_MAX_OPTIONS = 4;
const COMPACT_MAX_LABEL = 12;

/** single_choice and multi_select: a pill track for a few short options, otherwise rows. */
export function ChoiceField({ question, draft, onChange }: FieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const multi = question.kind === 'multi_select';
  const compact =
    !multi &&
    !question.allowOther &&
    question.options.length >= 2 &&
    question.options.length <= COMPACT_MAX_OPTIONS &&
    question.options.every((option) => option.length <= COMPACT_MAX_LABEL);

  if (compact) {
    const options: SegmentOption<string>[] = question.options.map((option) => ({
      value: option,
      label: option,
    }));
    return (
      <Segmented
        options={options}
        value={draft.text || null}
        onChange={(value) => onChange({ text: value })}
        accessibilityLabel={question.label}
      />
    );
  }

  const toggle = (option: string) => {
    if (multi) {
      const picked = draft.selected.includes(option)
        ? draft.selected.filter((item) => item !== option)
        : [...draft.selected, option];
      onChange({ selected: question.options.filter((item) => picked.includes(item)) });
    } else {
      onChange({ text: draft.text === option ? '' : option, otherOn: false });
    }
  };

  const toggleOther = () => {
    if (multi) {
      onChange({ otherOn: !draft.otherOn });
    } else {
      onChange({ otherOn: !draft.otherOn, text: '' });
    }
  };

  return (
    <View style={styles.list} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {question.options.map((option) => (
        <OptionRow
          key={option}
          label={option}
          mode={multi ? 'multi' : 'single'}
          selected={multi ? draft.selected.includes(option) : !draft.otherOn && draft.text === option}
          onPress={() => toggle(option)}
        />
      ))}
      {question.allowOther ? (
        <>
          <OptionRow
            label={t('questionnaireFill.other')}
            mode={multi ? 'multi' : 'single'}
            selected={draft.otherOn}
            quiet
            onPress={toggleOther}
          />
          {draft.otherOn ? (
            <Input
              label={t('questionnaireFill.otherLabel')}
              value={draft.other}
              onChangeText={(other) => onChange({ other })}
              maxLength={OTHER_MAX_LENGTH}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
    },
  });
