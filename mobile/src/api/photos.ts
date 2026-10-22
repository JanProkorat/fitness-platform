import { api } from '@/api/client';
import { PlanPhotoCategory } from '@/api/generated';
import type { ClientPhotoResponse } from '@/api/generated';

export const PHOTOS_QUERY_KEY = ['photos', 'me'] as const;

/** Largest page the endpoint accepts; one page of month groups covers the v1 screen. */
const PAGE_SIZE = 100;

/** The backend rejects larger uploads at the upload-url step. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Signed read URLs live 15 minutes, so cached photo lists must go stale well before that. */
export const PHOTOS_STALE_MS = 5 * 60 * 1000;

/** Quality below 1 makes the picker re-encode, which keeps camera shots under the size limit. */
export const PICK_QUALITY = 0.7;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** A photo the screen can show: the fields it relies on are present. */
export type ProgressPhoto = ClientPhotoResponse & { id: string; displayUrl: string };

export type PhotoMonth = { yearMonth: string; photos: ProgressPhoto[] };

const SHOWN_CATEGORIES = new Set<PlanPhotoCategory>([PlanPhotoCategory.Body, PlanPhotoCategory.FreeForm]);

const isShown = (photo: ClientPhotoResponse): photo is ProgressPhoto =>
  Boolean(photo.id) &&
  Boolean(photo.displayUrl) &&
  photo.category !== undefined &&
  SHOWN_CATEGORIES.has(photo.category);

/**
 * The client's progress photos grouped by month, newest first (GET /client/me/photos).
 * The endpoint also returns Food and Training photos, which are dropped here, and so are
 * months left empty by that.
 */
export async function fetchPhotoMonths(signal?: AbortSignal): Promise<PhotoMonth[]> {
  const response = await api.getMyPhotosEndpoint(1, PAGE_SIZE, true, undefined, undefined, undefined, signal);
  const months: PhotoMonth[] = [];
  for (const group of response.groups ?? []) {
    const photos = (group.photos ?? []).filter(isShown);
    if (group.yearMonth && photos.length > 0) {
      months.push({ yearMonth: group.yearMonth, photos });
    }
  }
  return months;
}

/** Removes one of the caller's own photos (DELETE /client/photos/{photoId}). */
export function deletePhoto(photoId: string): Promise<void> {
  return api.deletePlanPhotoEndpoint(photoId);
}

export type PhotoUploadFailure = 'tooLarge' | 'unsupportedType' | 'unreadable' | 'upload';

/** Thrown before or during an upload; `failure` picks the message shown to the user. */
export class PhotoUploadError extends Error {
  readonly failure: PhotoUploadFailure;

  constructor(failure: PhotoUploadFailure) {
    super(`Photo upload failed: ${failure}`);
    this.name = 'PhotoUploadError';
    this.failure = failure;
  }
}

/** What the picker hands back; `fileSize` and `mimeType` are optional on some platforms. */
export type PickedPhoto = { uri: string; mimeType?: string; fileSize?: number };

const normalizeType = (type: string | undefined): string => {
  const lower = (type ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  return lower === 'image/jpg' ? 'image/jpeg' : lower;
};

/**
 * Uploads a picked photo as a plan-less Body photo: signed URL, direct PUT, then finalize.
 * Type and size are checked first so a photo the backend would refuse never leaves the device.
 */
export async function uploadProgressPhoto(photo: PickedPhoto): Promise<void> {
  let blob: Blob;
  try {
    blob = await (await fetch(photo.uri)).blob();
  } catch {
    throw new PhotoUploadError('unreadable');
  }

  const contentType = normalizeType(photo.mimeType ?? blob.type);
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new PhotoUploadError('unsupportedType');
  }
  const sizeBytes = photo.fileSize ?? blob.size;
  if (sizeBytes > MAX_PHOTO_BYTES) {
    throw new PhotoUploadError('tooLarge');
  }

  const { uploadUrl, blobUrl } = await api.generateUnlinkedPhotoUploadUrlEndpoint({ contentType, sizeBytes });
  if (!uploadUrl || !blobUrl) {
    throw new PhotoUploadError('upload');
  }

  // Plain fetch on purpose: the shared axios client would add the bearer token, and blob
  // storage must only ever see the query signature.
  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  } catch {
    throw new PhotoUploadError('upload');
  }
  if (!put.ok) {
    throw new PhotoUploadError('upload');
  }

  await api.finalizeUnlinkedPhotoEndpoint({ blobUrl, category: PlanPhotoCategory.Body });
}
