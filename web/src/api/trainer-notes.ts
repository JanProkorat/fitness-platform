import api from '@/lib/api';

export interface TrainerNote {
  noteId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteResponse {
  noteId: string;
  createdAt: string;
}

export interface ListNotesResponse {
  notes: TrainerNote[];
  totalCount: number;
}

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
): Promise<ListNotesResponse> {
  const { data, headers } = await api.get<{ notes: TrainerNote[] }>(
    `/trainer/clients/${clientId}/notes`,
    { params: { page, pageSize } },
  );
  const totalCount = parseInt(headers['x-total-count'] ?? '0', 10);
  return { notes: data.notes ?? [], totalCount };
}

export interface EditNoteResponse {
  noteId: string;
  text: string;
  updatedAt: string;
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
