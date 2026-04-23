/**
 * Ergonomic wrappers around the NSwag-generated avatar upload endpoints.
 *
 * User avatar:        POST /users/me/avatar/upload-url → PUT external presigned URL → PUT /users/me/avatar
 * Professional avatar: POST /professionals/me/avatar/upload-url → PUT external presigned URL → PUT /professionals/me/avatar
 */

import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadKind = 'user' | 'professional';

export interface AvatarUploadUrlArgs {
  contentType: string;
  sizeBytes: number;
}

export interface AvatarUploadUrlResult {
  uploadUrl: string;
  blobUrl: string;
}

// ─── Request upload URL ───────────────────────────────────────────────────────

export async function requestUserAvatarUploadUrl(
  args: AvatarUploadUrlArgs,
): Promise<AvatarUploadUrlResult> {
  const { data } = await api.post<AvatarUploadUrlResult>(
    '/users/me/avatar/upload-url',
    { contentType: args.contentType, sizeBytes: args.sizeBytes },
  );
  return data;
}

export async function requestProfessionalAvatarUploadUrl(
  args: AvatarUploadUrlArgs,
): Promise<AvatarUploadUrlResult> {
  const { data } = await api.post<AvatarUploadUrlResult>(
    '/professionals/me/avatar/upload-url',
    { contentType: args.contentType, sizeBytes: args.sizeBytes },
  );
  return data;
}

// ─── Confirm (commit) uploaded avatar ────────────────────────────────────────

export async function confirmUserAvatar(blobUrl: string): Promise<void> {
  await api.put('/users/me/avatar', { blobUrl });
}

export async function confirmProfessionalAvatar(blobUrl: string): Promise<void> {
  await api.put('/professionals/me/avatar', { blobUrl });
}

// ─── Delete avatar ────────────────────────────────────────────────────────────

export async function deleteUserAvatar(): Promise<void> {
  await api.delete('/users/me/avatar');
}

export async function deleteProfessionalAvatar(): Promise<void> {
  await api.delete('/professionals/me/avatar');
}
