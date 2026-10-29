import type { Draft, FillQuestion } from '@/components/questionnaire/fillModel';

/** What every answer renderer receives. `onChange` merges a patch into the question's draft. */
export type FieldProps = {
  question: FillQuestion;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
};
