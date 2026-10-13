import { useCallback, useMemo, useRef, useState } from 'react';
import type { QuestionnaireDto } from '@/api/questionnaires';
import { toDraftForm, type DraftForm, type FormServerState } from '@/components/forms/builder/form-builder-model';

interface State {
  doc: DraftForm;
  baselineJson: string;
  server: FormServerState;
}

export interface FormBuilderState {
  doc: DraftForm;
  server: FormServerState;
  /** True when the draft differs from the last saved version. */
  dirty: boolean;
  edit: (update: (doc: DraftForm) => DraftForm) => void;
  /** While locked (a save is in flight) edits are ignored, so the server copy can replace the draft safely. */
  setLocked: (locked: boolean) => void;
  /** Records a successful save: `saved` is the server's copy, `sent` the draft that was sent. */
  markSaved: (saved: QuestionnaireDto, sent: DraftForm) => void;
}

/** Local editing state for one form: the draft, the last saved snapshot and the values only the server owns. */
export function useFormBuilderState(initial: QuestionnaireDto): FormBuilderState {
  const [state, setState] = useState<State>(() => {
    const { draft, server } = toDraftForm(initial);
    return { doc: draft, baselineJson: JSON.stringify(draft), server };
  });
  const locked = useRef(false);

  const dirty = useMemo(() => JSON.stringify(state.doc) !== state.baselineJson, [state.doc, state.baselineJson]);

  const edit = useCallback<FormBuilderState['edit']>((update) => {
    if (locked.current) {
      return;
    }
    setState((current) => {
      const next = update(current.doc);
      return next === current.doc ? current : { ...current, doc: next };
    });
  }, []);

  const setLocked = useCallback((value: boolean) => {
    locked.current = value;
  }, []);

  const markSaved = useCallback<FormBuilderState['markSaved']>((saved, sent) => {
    const { draft, server } = toDraftForm(saved);
    // Visible questions come back in the order they were sent; keep their keys so cards do not remount.
    const questions =
      draft.questions.length === sent.questions.length
        ? draft.questions.map((question, index) => ({ ...question, key: sent.questions[index]?.key ?? question.key }))
        : draft.questions;
    const next = { ...draft, questions };
    setState((current) => ({
      doc: current.doc === sent ? next : current.doc,
      baselineJson: JSON.stringify(next),
      server,
    }));
  }, []);

  return { doc: state.doc, server: state.server, dirty, edit, setLocked, markSaved };
}
