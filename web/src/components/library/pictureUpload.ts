import { useEffect, useRef, useState } from 'react';
import i18n from '@/i18n';
import { showError } from '@/lib/api-errors';
import { useToastStore } from '@/stores/toast';

/** jpeg/png/webp only — mirrors the chat-attachment composer's own
 * client-side allowlist (`Composer.tsx`). The server additionally accepts
 * heic/heif, but browsers can't render those, so the web picker never offers
 * them; the server stays the real authority either way. */
export const ALLOWED_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const FILE_PICKER_ACCEPT = ALLOWED_IMAGE_CONTENT_TYPES.join(',');
/** Mirrors the server's `ImageUploadService.MaxImageSizeBytes` (5 MiB). */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
/** Mirrors the server's gallery cap (`RECIPE_GALLERY_FULL` / `FOOD_GALLERY_FULL`). */
export const MAX_GALLERY_IMAGES = 6;

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

/**
 * Runs one picture upload: mint a pre-signed URL, PUT the bytes, then confirm
 * the blob URL. Confirm only runs after the PUT succeeded.
 */
export async function uploadPictureFile(
  file: File,
  requestUploadUrl: (file: { contentType: string; sizeBytes: number }) => Promise<{ uploadUrl: string; blobUrl: string }>,
  confirmUpload: (blobUrl: string) => Promise<void>,
): Promise<void> {
  const { uploadUrl, blobUrl } = await requestUploadUrl({ contentType: file.type, sizeBytes: file.size });
  if (!uploadUrl || !blobUrl) {
    throw new Error('Upload URL response missing uploadUrl/blobUrl');
  }
  await putFileToBlobStorage(uploadUrl, file);
  await confirmUpload(blobUrl);
}

/** A picture picked in create mode, held in the browser until the item exists. */
export interface StagedPicture {
  id: string;
  file: File;
  previewUrl: string;
}

interface StagedState {
  main: StagedPicture | null;
  extras: StagedPicture[];
}

export interface StagedPictures extends StagedState {
  /** Stages a main picture, replacing any current one. An invalid file is rejected with a toast. */
  setMainFile: (file: File) => void;
  /** Stages extra pictures up to the gallery cap; invalid files are rejected with a toast. */
  addExtraFiles: (files: File[]) => void;
  removeMain: () => void;
  removeExtra: (id: string) => void;
  /** Makes a staged extra the main picture; the previous main takes its slot. */
  promoteExtra: (id: string) => void;
  /** Drops everything staged and revokes its preview URLs. */
  clear: () => void;
}

let stagedIdCounter = 0;

function stagePicture(file: File): StagedPicture {
  stagedIdCounter += 1;
  return { id: `staged-${stagedIdCounter}`, file, previewUrl: URL.createObjectURL(file) };
}

function revoke(picture: StagedPicture | null | undefined) {
  if (picture) {
    URL.revokeObjectURL(picture.previewUrl);
  }
}

function acceptable(file: File): boolean {
  const errorKey = imageFileErrorKey(file);
  if (errorKey) {
    showError(errorKey);
    return false;
  }
  return true;
}

/**
 * Create-mode picture staging with preview URLs. Previews are revoked on
 * remove, on `clear()` and on unmount.
 */
export function useStagedPictures(): StagedPictures {
  const [state, setState] = useState<StagedState>({ main: null, extras: [] });
  // Source of truth for updates: sequential calls in one tick (a multi-file add)
  // must each see the previous call's result, which a render closure would not.
  const stateRef = useRef<StagedState>(state);

  function commit(next: StagedState) {
    stateRef.current = next;
    setState(next);
  }

  useEffect(() => {
    return () => {
      const { main, extras } = stateRef.current;
      revoke(main);
      extras.forEach(revoke);
    };
  }, []);

  return {
    main: state.main,
    extras: state.extras,
    setMainFile(file) {
      if (!acceptable(file)) {
        return;
      }
      const { main, extras } = stateRef.current;
      revoke(main);
      commit({ main: stagePicture(file), extras });
    },
    addExtraFiles(files) {
      const { main, extras } = stateRef.current;
      const room = Math.max(MAX_GALLERY_IMAGES - extras.length, 0);
      const accepted = files.filter(acceptable).slice(0, room);
      if (accepted.length > 0) {
        commit({ main, extras: [...extras, ...accepted.map(stagePicture)] });
      }
    },
    removeMain() {
      const { main, extras } = stateRef.current;
      revoke(main);
      commit({ main: null, extras });
    },
    removeExtra(id) {
      const { main, extras } = stateRef.current;
      revoke(extras.find((picture) => picture.id === id));
      commit({ main, extras: extras.filter((picture) => picture.id !== id) });
    },
    promoteExtra(id) {
      const { main, extras } = stateRef.current;
      const target = extras.find((picture) => picture.id === id);
      if (!target) {
        return;
      }
      commit({
        main: target,
        extras: main
          ? extras.map((picture) => (picture.id === id ? main : picture))
          : extras.filter((picture) => picture.id !== id),
      });
    },
    clear() {
      const { main, extras } = stateRef.current;
      revoke(main);
      extras.forEach(revoke);
      commit({ main: null, extras: [] });
    },
  };
}

/**
 * Uploads staged pictures one after another — the main first, then the extras.
 * A failed picture does not stop the rest; returns how many failed.
 */
export async function uploadStagedPictures(
  staged: StagedState,
  uploadMain: (file: File) => Promise<void>,
  uploadGallery: (file: File) => Promise<void>,
): Promise<number> {
  let failed = 0;
  if (staged.main) {
    try {
      await uploadMain(staged.main.file);
    } catch {
      failed += 1;
    }
  }
  for (const picture of staged.extras) {
    try {
      await uploadGallery(picture.file);
    } catch {
      failed += 1;
    }
  }
  return failed;
}

/** One error toast for a create whose item was saved but whose pictures did not all upload. */
export function showPartialUploadError(failedCount: number): void {
  useToastStore.getState().addToast(i18n.t('library.picture.partialUploadError', { count: failedCount }), 'error');
}
