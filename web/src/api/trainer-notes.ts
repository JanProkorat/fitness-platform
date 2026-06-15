import api from '@/lib/api';
import type {
  NoteDto,
  CreateNoteResponse,
  EditNoteResponse,
  ListNotesResponse,
} from '@/api/generated';

// Re-export generated types so consumers can import from this module unchanged.
export type { CreateNoteResponse, EditNoteResponse, ListNotesResponse };

/**
 * Alias for the generated NoteDto — keeps consumer imports stable
 * (`import type { TrainerNote } from '@/api/trainer-notes'`).
 */
export type TrainerNote = NoteDto;

export async function createNote(
  clientId: string,
  text: string,
): Promise<CreateNoteResponse> {
  const { data } = await api.post<CreateNoteResponse>(
    `/trainer/clients/${clientId}/notes`,
    { text },
  );
  return data;
}

export async function listNotes(
  clientId: string,
  page = 1,
  pageSize = 20,
): Promise<{ notes: TrainerNote[]; totalCount: number }> {
  const { data, headers } = await api.get<ListNotesResponse>(
    `/trainer/clients/${clientId}/notes`,
    { params: { page, pageSize } },
  );
  const totalCount = parseInt(headers['x-total-count'] ?? '0', 10);
  return { notes: data.notes ?? [], totalCount };
}

export async function updateNote(
  clientId: string,
  noteId: string,
  text: string,
): Promise<EditNoteResponse> {
  const { data } = await api.patch<EditNoteResponse>(
    `/trainer/clients/${clientId}/notes/${noteId}`,
    { text },
  );
  return data;
}

export async function deleteNote(
  clientId: string,
  noteId: string,
): Promise<void> {
  await api.delete(`/trainer/clients/${clientId}/notes/${noteId}`);
}
