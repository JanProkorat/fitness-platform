import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '@/api/client';
import { getErrorStatus, isNetworkError } from '@/api/errors';
import {
  ONBOARDING_ANSWERS_QUERY_KEY,
  buildAnswersPatch,
  changedAnswerFields,
  isAnswersUnavailable,
  updateOnboardingAnswers,
  validateAnswers,
} from '@/api/onboardingAnswers';
import type { AnswerError, AnswerField, EditableAnswers } from '@/api/onboardingAnswers';
import { PROFILE_QUERY_KEY, PROFILE_SUMMARY_QUERY_KEY } from '@/api/profile';
import type { Profile } from '@/api/profile';

/** Field limits mirror UpdateProfileValidator. */
export const PERSONAL_LIMITS = { name: 50, phone: 30 } as const;

export type Personal = { firstName: string; lastName: string; phone: string };
export type PersonalField = keyof Personal;

export type SaveFailure = 'network' | 'invalid' | 'generic';

export type SaveProblem = {
  failure: SaveFailure;
  /** Part of the form saved and part did not. */
  partial: boolean;
  /** Lower-cased field names the server named in a 400, to flag inputs. */
  fields: string[];
};

type PartResult<T> =
  | { status: 'skipped' }
  | { status: 'saved'; value: T }
  | { status: 'failed'; error: unknown };

type SaveOutcome = {
  personal: PartResult<Personal>;
  answers: PartResult<EditableAnswers>;
};

const personalFromProfile = (profile: Profile): Personal => ({
  firstName: profile.firstName ?? '',
  lastName: profile.lastName ?? '',
  phone: profile.phoneNumber ?? '',
});

const trimmed = (personal: Personal): Personal => ({
  firstName: personal.firstName.trim(),
  lastName: personal.lastName.trim(),
  phone: personal.phone.trim(),
});

const samePersonal = (a: Personal, b: Personal): boolean =>
  a.firstName === b.firstName && a.lastName === b.lastName && a.phone === b.phone;

function classify(error: unknown): SaveFailure {
  if (isNetworkError(error)) return 'network';
  if (getErrorStatus(error) === 400) return 'invalid';
  return 'generic';
}

/** Names of the fields a 400 ProblemDetails body lists in `errors[]`. */
function serverFields(error: unknown): string[] {
  if (typeof error !== 'object' || error === null || !('errors' in error)) return [];
  const { errors } = error;
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((entry: unknown) =>
    typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string'
      ? [entry.name.toLowerCase()]
      : [],
  );
}

async function attempt<T>(run: () => Promise<T>): Promise<PartResult<T>> {
  try {
    return { status: 'saved', value: await run() };
  } catch (error) {
    return { status: 'failed', error };
  }
}

/**
 * Form state of the Edit profile screen: the personal fields (PUT /users/me) and the My info
 * answers (PATCH /client/onboarding/answers), each saved only when it changed.
 * `answers` is `null` when the client has none to edit.
 */
export function useEditProfile(profile: Profile, answers: EditableAnswers | null) {
  const queryClient = useQueryClient();
  const [personalBase, setPersonalBase] = useState(() => personalFromProfile(profile));
  const [personal, setPersonal] = useState(() => personalFromProfile(profile));
  const [answersBase, setAnswersBase] = useState(answers);
  const [draft, setDraft] = useState(answers);
  const [unavailable, setUnavailable] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [saved, setSaved] = useState(false);

  const answersActive = draft !== null && answersBase !== null && !unavailable;
  const changedAnswers: AnswerField[] = answersActive ? changedAnswerFields(answersBase, draft) : [];
  const answerErrors: Partial<Record<AnswerField, AnswerError>> = answersActive
    ? validateAnswers(draft)
    : {};

  const personalErrors: Partial<Record<PersonalField, 'required'>> = {};
  if (personal.firstName.trim().length === 0) personalErrors.firstName = 'required';
  if (personal.lastName.trim().length === 0) personalErrors.lastName = 'required';

  const personalDirty = !samePersonal(trimmed(personal), personalBase);
  const dirty = personalDirty || changedAnswers.length > 0;
  const valid = Object.keys(personalErrors).length === 0 && Object.keys(answerErrors).length === 0;

  const mutation = useMutation({
    mutationFn: async (): Promise<SaveOutcome> => {
      const outcome: SaveOutcome = { personal: { status: 'skipped' }, answers: { status: 'skipped' } };
      if (personalDirty) {
        const sent = trimmed(personal);
        // PUT replaces the whole profile, so the phone always goes along with the names.
        outcome.personal = await attempt(async () => {
          await api.updateProfileEndpoint({
            firstName: sent.firstName,
            lastName: sent.lastName,
            phoneNumber: sent.phone.length > 0 ? sent.phone : undefined,
          });
          return sent;
        });
      }
      if (answersActive && changedAnswers.length > 0) {
        const patch = buildAnswersPatch(draft, changedAnswers);
        outcome.answers = await attempt(() => updateOnboardingAnswers(patch));
      }
      return outcome;
    },
    onSuccess: ({ personal: personalResult, answers: answersResult }) => {
      if (personalResult.status === 'saved') {
        setPersonalBase(personalResult.value);
        setPersonal(personalResult.value);
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      }
      if (answersResult.status === 'saved') {
        setAnswersBase(answersResult.value);
        setDraft(answersResult.value);
        void queryClient.invalidateQueries({ queryKey: ONBOARDING_ANSWERS_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_QUERY_KEY });
      }
      if (answersResult.status === 'failed' && isAnswersUnavailable(answersResult.error)) {
        setUnavailable(true);
      }

      const errors = [personalResult, answersResult].flatMap((part) =>
        part.status === 'failed' ? [part.error] : [],
      );
      if (errors.length === 0) {
        setSaved(true);
        return;
      }
      const didSave = personalResult.status === 'saved' || answersResult.status === 'saved';
      setProblem({
        failure: classify(errors[0]),
        partial: didSave,
        fields: errors.flatMap(serverFields),
      });
    },
  });

  const setPersonalField = (field: PersonalField, value: string) => {
    setPersonal((current) => ({ ...current, [field]: value }));
    setProblem(null);
  };

  const setAnswer = <K extends AnswerField>(field: K, value: EditableAnswers[K]) => {
    setDraft((current) => (current === null ? current : { ...current, [field]: value }));
    setProblem(null);
  };

  return {
    personal,
    setPersonalField,
    personalErrors,
    /** The answers being edited, or `null` when the My info section is not available. */
    answers: answersActive ? draft : null,
    setAnswer,
    answerErrors,
    /** True when the server named `field` (lower-cased) in its last 400 response. */
    serverFlagged: (field: string) => problem?.fields.includes(field.toLowerCase()) ?? false,
    dirty,
    valid,
    isSaving: mutation.isPending,
    /** True once everything changed has been saved. */
    saved,
    problem,
    save: () => {
      if (mutation.isPending || !dirty || !valid) return;
      setProblem(null);
      mutation.mutate();
    },
  };
}
