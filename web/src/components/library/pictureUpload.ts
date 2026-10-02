/** jpeg/png/webp only — mirrors the chat-attachment composer's own
 * client-side allowlist (`Composer.tsx`). The server additionally accepts
 * heic/heif, but browsers can't render those, so the web picker never offers
 * them; the server stays the real authority either way. */
export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const FILE_PICKER_ACCEPT = ALLOWED_IMAGE_CONTENT_TYPES.join(',');
/** Mirrors the server's `ImageUploadService.MaxImageSizeBytes` (5 MiB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Error key for a file the client rejects before any request, or `null` when it is acceptable. */
export function imageFileErrorKey(file: File): string | null {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.includes(file.type)) {
    return 'apiErrors.INVALID_IMAGE_CONTENT_TYPE';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'apiErrors.IMAGE_TOO_LARGE';
  }
  return null;
}

/**
 * PUTs the bytes straight to blob storage with a bare `fetch` — never through
 * the axios instance, because a presigned URL doesn't expect the API's
 * Authorization header.
 */
export async function putFileToBlobStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Image upload PUT failed with status ${response.status}`);
  }
}
