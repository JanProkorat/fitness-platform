import { api } from '@/api/client';
import { getProblemCode, isNetworkError } from '@/api/errors';

/** Largest avatar the backend accepts (ImageUploadService.MaxImageSizeBytes). */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** A photo chosen on the device, ready to upload. */
export type AvatarAsset = {
  uri: string;
  mimeType: string;
};

export type AvatarFailure = 'tooLarge' | 'unsupported' | 'network' | 'generic';

/** Thrown when the storage service rejects the photo upload itself. */
class AvatarStorageError extends Error {}

/**
 * Uploads a new avatar: asks for a signed URL, sends the file to it and confirms the stored copy.
 * The file goes through plain `fetch` on purpose: the shared axios client would add the bearer token
 * to a request that is not for our API.
 */
export async function uploadAvatar(asset: AvatarAsset): Promise<void> {
  const file = await (await fetch(asset.uri)).blob();
  if (file.size > MAX_AVATAR_BYTES) throw new AvatarStorageError('too large');

  const target = await api.generateAvatarUploadUrlEndpoint({
    contentType: asset.mimeType,
    sizeBytes: file.size,
  });
  if (!target.uploadUrl || !target.blobUrl) throw new AvatarStorageError('no upload url');

  const response = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': asset.mimeType },
    body: file,
  });
  if (!response.ok) throw new AvatarStorageError(`upload failed (${response.status})`);

  await api.confirmAvatarEndpoint({ blobUrl: target.blobUrl });
}

/** Removes the avatar (DELETE /users/me/avatar). */
export async function removeAvatar(): Promise<void> {
  await api.deleteAvatarEndpoint();
}

/** Maps anything the avatar calls can throw to the line the screen shows. */
export function classifyAvatarError(error: unknown): AvatarFailure {
  if (error instanceof AvatarStorageError) {
    return error.message === 'too large' ? 'tooLarge' : 'generic';
  }
  const code = getProblemCode(error);
  if (code === 'IMAGE_TOO_LARGE') return 'tooLarge';
  if (code === 'INVALID_IMAGE_CONTENT_TYPE') return 'unsupported';
  // A failed `fetch` throws a TypeError; axios reports a missing response itself.
  if (isNetworkError(error) || error instanceof TypeError) return 'network';
  return 'generic';
}
