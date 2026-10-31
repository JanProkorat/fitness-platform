import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClientQuestionnaire, QuestionnaireFailure } from '@/api/questionnaires';
import { stepsBlocked } from '@/components/questionnaire/fillModel';
import type { Draft, Drafts, FillStep } from '@/components/questionnaire/fillModel';
import { firstName } from '@/components/invites/format';
import { useQuestionnaireFill } from '@/hooks/useQuestionnaireFill';
import { useSendQuestionnaire } from '@/hooks/useSendQuestionnaire';
import type { SentSummary } from '@/hooks/useSendQuestionnaire';

type FillValue = {
  linkPublicId: string;
  title: string;
  description: string | null;
  /** The coach's full name as the API sends it; empty when unknown. */
  coachName: string;
  coachFirstName: string;
  coachRole: string | undefined;
  steps: readonly FillStep[];
  drafts: Drafts;
  setDraft: (questionId: string, patch: Partial<Draft>) => void;
  /** A required answer is missing or a number is out of range somewhere in the form. */
  blocked: boolean;
  send: (onSent: () => void) => void;
  sending: boolean;
  failure: QuestionnaireFailure | null;
  sent: SentSummary | null;
  /** Asks to leave; the discard prompt shows first when answers would be lost. */
  requestClose: () => void;
  /** Leaves without the prompt. */
  leave: () => void;
};

const FillContext = createContext<FillValue | null>(null);

export function useFill(): FillValue {
  const value = useContext(FillContext);
  if (!value) throw new Error('useFill must be used inside FillProvider.');
  return value;
}

type FillProviderProps = {
  linkPublicId: string;
  data: ClientQuestionnaire;
  children: ReactNode;
};

/** Owns the draft answers and the send for one pass through the flow; lives in the route layout. */
export function FillProvider({ linkPublicId, data, children }: FillProviderProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { steps, drafts, setDraft, touched } = useQuestionnaireFill(data);
  const { send, sending, failure, sent } = useSendQuestionnaire(data, steps, drafts);
  const [released, setReleased] = useState(false);

  usePreventRemove(touched && sent === null && !released, ({ data: removal }) => {
    Alert.alert(t('questionnaireFill.discard.title'), t('questionnaireFill.discard.body'), [
      { text: t('questionnaireFill.discard.keep'), style: 'cancel' },
      {
        text: t('questionnaireFill.discard.discard'),
        style: 'destructive',
        onPress: () => navigation.dispatch(removal.action),
      },
    ]);
  });

  // The guard is already off by the time this runs, so the close goes through.
  useEffect(() => {
    if (released) navigation.goBack();
  }, [released, navigation]);

  const requestClose = useCallback(() => navigation.goBack(), [navigation]);
  const leave = useCallback(() => setReleased(true), []);

  const coachName = data.professionalName?.trim() ?? '';
  const value: FillValue = {
    linkPublicId,
    title: data.title ?? '',
    description: data.description?.trim() ? data.description.trim() : null,
    coachName,
    coachFirstName: firstName(coachName),
    coachRole: data.professionalRole,
    steps,
    drafts,
    setDraft,
    blocked: stepsBlocked(steps, drafts),
    send,
    sending,
    failure,
    sent,
    requestClose,
    leave,
  };

  return <FillContext.Provider value={value}>{children}</FillContext.Provider>;
}
