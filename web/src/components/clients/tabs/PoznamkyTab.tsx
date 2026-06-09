import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useToastStore } from '@/stores/toast';
import {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
  type TrainerNote,
} from '@/api/trainer-notes';

interface PoznamkyTabProps {
  clientId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

// ── Sub-component: a single editable note card ────────────────────────────────

interface NoteCardProps {
  note: TrainerNote;
  clientId: string;
}

function NoteCard({ note, clientId }: NoteCardProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);

  const updateMutation = useMutation({
    mutationFn: (text: string) => updateNote(clientId, note.noteId, text),
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({
        queryKey: ['trainer-notes', clientId],
      });
      const previous = queryClient.getQueryData<TrainerNote[]>([
        'trainer-notes',
        clientId,
      ]);
      queryClient.setQueryData<TrainerNote[]>(
        ['trainer-notes', clientId],
        (old) =>
          old?.map((n) =>
            n.noteId === note.noteId
              ? { ...n, text, updatedAt: new Date().toISOString() }
              : n,
          ) ?? [],
      );
      return { previous };
    },
    onError: (_err, _text, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trainer-notes', clientId], context.previous);
      }
      addToast(t('clientDetail.poznamky.updateError'), 'error');
    },
    onSuccess: () => {
      addToast(t('clientDetail.poznamky.updateSuccess'), 'success');
      setEditing(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-notes', clientId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNote(clientId, note.noteId),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ['trainer-notes', clientId],
      });
      const previous = queryClient.getQueryData<TrainerNote[]>([
        'trainer-notes',
        clientId,
      ]);
      queryClient.setQueryData<TrainerNote[]>(
        ['trainer-notes', clientId],
        (old) => old?.filter((n) => n.noteId !== note.noteId) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trainer-notes', clientId], context.previous);
      }
      addToast(t('clientDetail.poznamky.deleteError'), 'error');
    },
    onSuccess: () => {
      addToast(t('clientDetail.poznamky.deleteSuccess'), 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-notes', clientId] });
    },
  });

  if (editing) {
    return (
      <div className="border border-border rounded-[var(--radius-md)] bg-bg2 px-3 py-3 flex flex-col gap-2">
        <textarea
          className="w-full text-[13px] text-text bg-transparent border border-border rounded-[var(--radius-sm)] px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          rows={3}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={2000}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="text-[12px] text-text3 px-3 py-1.5 border border-border rounded-[var(--radius-sm)] hover:bg-bg-hover transition-colors"
            onClick={() => {
              setEditing(false);
              setEditText(note.text);
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={updateMutation.isPending || !editText.trim()}
            className="text-[12px] font-medium text-text px-3 py-1.5 border border-border rounded-[var(--radius-sm)] bg-bg2 hover:bg-bg-hover transition-colors disabled:opacity-50"
            onClick={() => updateMutation.mutate(editText)}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-[var(--radius-md)] bg-bg2 px-3 py-3 flex items-start gap-2 group">
      <div className="text-[16px] mt-0.5 shrink-0">📌</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-text whitespace-pre-wrap break-words">
          {note.text}
        </div>
        <div className="text-[11px] text-text3 mt-1">{formatDate(note.createdAt)}</div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          aria-label={t('clientDetail.poznamky.editAriaLabel')}
          className="text-[11px] text-text3 hover:text-text px-2 py-1 rounded-[var(--radius-sm)] hover:bg-bg-hover transition-colors"
          onClick={() => setEditing(true)}
        >
          {t('clientDetail.poznamky.editLabel')}
        </button>
        <button
          type="button"
          aria-label={t('clientDetail.poznamky.deleteAriaLabel')}
          disabled={deleteMutation.isPending}
          className="text-[11px] text-text3 hover:text-red px-2 py-1 rounded-[var(--radius-sm)] hover:bg-bg-hover transition-colors disabled:opacity-50"
          onClick={() => deleteMutation.mutate()}
        >
          {t('clientDetail.poznamky.deleteLabel')}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PoznamkyTab({ clientId }: PoznamkyTabProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState('');

  const { data: notes, isPending, isError } = useQuery({
    queryKey: ['trainer-notes', clientId],
    queryFn: async () => {
      const result = await listNotes(clientId);
      return result.notes;
    },
    enabled: Boolean(clientId),
    initialData: undefined,
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => createNote(clientId, text),
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({
        queryKey: ['trainer-notes', clientId],
      });
      const previous = queryClient.getQueryData<TrainerNote[]>([
        'trainer-notes',
        clientId,
      ]);
      const optimisticNote: TrainerNote = {
        noteId: `optimistic-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<TrainerNote[]>(
        ['trainer-notes', clientId],
        (old) => [optimisticNote, ...(old ?? [])],
      );
      setNewText('');
      return { previous };
    },
    onError: (_err, _text, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trainer-notes', clientId], context.previous);
      }
      addToast(t('clientDetail.poznamky.createError'), 'error');
    },
    onSuccess: () => {
      addToast(t('clientDetail.poznamky.createSuccess'), 'success');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-notes', clientId] });
    },
  });

  const handleSubmit = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  return (
    <div id="cl-pane-poznamky">
      {/* Heading */}
      <div className="text-[15px] font-semibold text-text mb-1.5">
        {t('clientDetail.poznamky.title')}{' '}
        <span className="text-[12px] font-normal text-text3">
          {t('clientDetail.poznamky.subtitle')}
        </span>
      </div>

      {/* Add-note box */}
      <div className="border border-border rounded-[var(--radius-md)] px-3 py-3 mb-3.5">
        <textarea
          className="w-full text-[13px] text-text bg-transparent border-none resize-none focus:outline-none placeholder:text-text3"
          rows={2}
          placeholder={t('clientDetail.poznamky.placeholder')}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <div className="flex justify-end mt-1">
          <button
            type="button"
            disabled={createMutation.isPending || !newText.trim()}
            className="text-[13px] font-medium text-text px-3 py-1.5 border border-border rounded-[var(--radius-sm)] bg-bg2 hover:bg-bg-hover transition-colors disabled:opacity-50"
            onClick={handleSubmit}
          >
            {t('clientDetail.poznamky.saveButton')}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isPending && (
        <div className="text-[13px] text-text3 py-8 text-center">
          {t('common.loading')}
        </div>
      )}

      {/* Error state */}
      {!isPending && isError && (
        <div className="text-[13px] text-red py-8 text-center">
          {t('clientDetail.poznamky.errorLoading')}
        </div>
      )}

      {/* Note list (newest first) */}
      {!isPending && !isError && notes && notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <NoteCard key={note.noteId} note={note} clientId={clientId} />
          ))}
        </div>
      )}

      {/* Empty state — show nothing extra; add-note box is always visible */}
      {!isPending && !isError && (!notes || notes.length === 0) && (
        <div className="text-[13px] text-text3 text-center py-6">
          {t('clientDetail.poznamky.emptyState')}
        </div>
      )}
    </div>
  );
}
