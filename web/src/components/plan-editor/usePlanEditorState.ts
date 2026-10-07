import { useCallback, useMemo, useReducer } from 'react';
import { MAX_UNDO_STEPS, type EditorDocument } from '@/components/plan-editor/plan-editor-types';

interface State {
  doc: EditorDocument;
  baseline: EditorDocument;
  baselineJson: string;
  past: EditorDocument[];
  /** Key of the last edit, so consecutive edits with the same key share one undo step. */
  lastKey: string | null;
}

type Action =
  | { type: 'edit'; update: (doc: EditorDocument) => EditorDocument; coalesceKey: string | null }
  | { type: 'undo' }
  | { type: 'saved'; baseline: EditorDocument; sent: EditorDocument };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'edit': {
      const next = action.update(state.doc);
      if (next === state.doc) {
        return state;
      }
      const merge = action.coalesceKey !== null && action.coalesceKey === state.lastKey;
      const past = merge ? state.past : [...state.past, state.doc].slice(-MAX_UNDO_STEPS);
      return { ...state, doc: next, past, lastKey: action.coalesceKey };
    }
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return state;
      }
      return { ...state, doc: previous, past: state.past.slice(0, -1), lastKey: null };
    }
    case 'saved':
      return {
        ...state,
        // The server copy replaces the document only if nothing changed while the save was in flight.
        doc: state.doc === action.sent ? action.baseline : state.doc,
        baseline: action.baseline,
        baselineJson: JSON.stringify(action.baseline),
        lastKey: null,
      };
  }
}

function init(initial: EditorDocument): State {
  return { doc: initial, baseline: initial, baselineJson: JSON.stringify(initial), past: [], lastKey: null };
}

export interface PlanEditorState {
  doc: EditorDocument;
  /** True when the document differs from the last saved version. */
  dirty: boolean;
  canUndo: boolean;
  /** Applies a change as one undo step, or merges it into the previous step when `coalesceKey` repeats. */
  edit: (update: (doc: EditorDocument) => EditorDocument, coalesceKey?: string) => void;
  undo: () => void;
  /** Records a successful save: `saved` is the server's copy, `sent` the document that was sent. */
  markSaved: (saved: EditorDocument, sent: EditorDocument) => void;
}

/**
 * Local editing state for a plan document. Holds a snapshot undo stack (capped) and the last saved
 * version; the server copy is never touched while editing.
 */
export function usePlanEditorState(initial: EditorDocument): PlanEditorState {
  const [state, dispatch] = useReducer(reducer, initial, init);

  const dirty = useMemo(() => JSON.stringify(state.doc) !== state.baselineJson, [state.doc, state.baselineJson]);

  const edit = useCallback<PlanEditorState['edit']>((update, coalesceKey) => {
    dispatch({ type: 'edit', update, coalesceKey: coalesceKey ?? null });
  }, []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const markSaved = useCallback<PlanEditorState['markSaved']>((saved, sent) => {
    dispatch({ type: 'saved', baseline: saved, sent });
  }, []);

  return { doc: state.doc, dirty, canUndo: state.past.length > 0, edit, undo, markSaved };
}
