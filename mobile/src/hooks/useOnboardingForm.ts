import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  INITIAL_ANSWERS,
  TOTAL_STEPS,
  buildOnboardingRequest,
  classifyOnboardingError,
  isStepComplete,
  submitOnboarding,
} from '@/api/onboarding';
import type { ChipListKey, OnboardingAnswers, OnboardingFailure } from '@/api/onboarding';
import { PROFILE_QUERY_KEY } from '@/api/profile';

/** State of the six-step onboarding: answers, current step and the final submit. */
export function useOnboardingForm() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(INITIAL_ANSWERS);

  const mutation = useMutation({
    mutationFn: async (answersToSend: OnboardingAnswers) => {
      const request = buildOnboardingRequest(answersToSend);
      if (request === null) throw new Error('onboarding_incomplete');
      await submitOnboarding(request);
      // Stays pending until the profile says onboarding is done, so the screen hands over to home.
      await queryClient.refetchQueries({ queryKey: PROFILE_QUERY_KEY }, { throwOnError: true });
    },
  });

  const clearError = () => {
    if (mutation.isError) mutation.reset();
  };

  const set = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    clearError();
  };

  const setList = (key: ChipListKey, items: string[]) => {
    setAnswers((current) => ({ ...current, lists: { ...current.lists, [key]: items } }));
  };

  const valid = isStepComplete(step, answers);
  const isLastStep = step === TOTAL_STEPS;

  const goBack = (): boolean => {
    if (step <= 1 || mutation.isPending) return false;
    setStep(step - 1);
    clearError();
    return true;
  };

  /** Moves to the next step, or sends the answers from the last one. */
  const advance = () => {
    if (!valid || mutation.isPending) return;
    if (isLastStep) {
      mutation.mutate(answers);
    } else {
      setStep(step + 1);
    }
  };

  const failure: OnboardingFailure | null = mutation.isError
    ? classifyOnboardingError(mutation.error)
    : null;

  return {
    step,
    answers,
    set,
    setList,
    valid,
    isLastStep,
    isPending: mutation.isPending,
    failure,
    goBack,
    advance,
  };
}

export type OnboardingForm = ReturnType<typeof useOnboardingForm>;
