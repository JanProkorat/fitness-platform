import type { ChipListKey } from '@/api/onboarding';
import type { OnboardingForm } from '@/hooks/useOnboardingForm';

/** What every onboarding step receives from the screen. */
export type StepProps = {
  form: OnboardingForm;
  /** Opens the shared sheet for one chip list. */
  openSheet: (key: ChipListKey) => void;
};
