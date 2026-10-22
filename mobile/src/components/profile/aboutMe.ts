import type { TFunction } from 'i18next';

import type { EditableAnswers } from '@/api/onboardingAnswers';
import { EMPTY_VALUE } from '@/components/profile/format';

export type AboutMeRowKey = 'goal' | 'training' | 'eating' | 'injuries';

export type AboutMeRow = { key: AboutMeRowKey; label: string; value: string };

const SEPARATOR = ' · ';

const join = (parts: (string | null)[]): string => {
  const shown = parts.filter((part): part is string => part !== null && part.length > 0);
  return shown.length > 0 ? shown.join(SEPARATOR) : EMPTY_VALUE;
};

/** The four About me rows; a row with nothing to show gets a dash. */
export function aboutMeRows(t: TFunction, language: string, answers: EditableAnswers): AboutMeRow[] {
  const kg =
    answers.targetWeightKg === null
      ? null
      : new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(answers.targetWeightKg);
  const noAllergies =
    answers.allergies.length > 0
      ? t('profile.aboutMe.noAllergies', { list: answers.allergies.join(', ') })
      : null;

  return [
    {
      key: 'goal',
      label: t('profile.aboutMe.goal'),
      value: join([
        answers.goal ? t(`profile.goals.${answers.goal}`) : null,
        kg === null ? null : t('profile.aboutMe.targetWeight', { value: kg }),
      ]),
    },
    {
      key: 'training',
      label: t('profile.aboutMe.training'),
      value: join([
        answers.desiredDays === null
          ? null
          : t('editProfile.info.perWeekValue', { count: answers.desiredDays }),
        answers.gymAccess ? t(`profile.aboutMe.gym.${answers.gymAccess}`) : null,
      ]),
    },
    {
      key: 'eating',
      label: t('profile.aboutMe.eating'),
      value: join([
        answers.dietStyle ? t(`onboarding.eating.style.${answers.dietStyle}`) : null,
        noAllergies,
      ]),
    },
    {
      key: 'injuries',
      label: t('profile.aboutMe.injuries'),
      value: join([answers.injuries.length > 0 ? answers.injuries.join(', ') : null]),
    },
  ];
}
