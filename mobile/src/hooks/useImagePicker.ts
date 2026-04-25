/**
 * useImagePicker — camera + library image picker with upload.
 *
 * Handles:
 *  - Camera / media-library permission requests via expo-image-picker.
 *  - Source selection (camera | library | both) — 'both' presents an
 *    ActionSheetIOS on iOS and an Alert-based sheet on Android (no new deps).
 *  - 5 MB client-side size guard (configurable via maxBytes).
 *  - MIME detection from URI extension (jpg/jpeg, png, webp only).
 *  - PUT upload to a caller-supplied signed URL; progress is null because
 *    React Native's fetch does not expose upload progress on all platforms.
 *  - Optional multi-select: pass `allowsMultipleSelection: true` to enable
 *    selecting multiple images from the gallery in a single pick() call.
 *    On multi-select, uploads run in parallel and `onUploadedMany` is called
 *    with the full array of succeeded blob URLs.
 *
 * Usage (single-select — existing callers unchanged):
 *   const { pick, uploading, progress, error } = useImagePicker(
 *     { source: 'both', requestUploadUrl },
 *     (blobUrl) => console.log('uploaded to', blobUrl),
 *   );
 *
 * Usage (multi-select):
 *   const { pick, uploading, progress, error } = useImagePicker(
 *     { source: 'library', allowsMultipleSelection: true, requestUploadUrl },
 *     undefined,
 *     (blobUrls) => console.log('uploaded', blobUrls.length, 'photos'),
 *   );
 */

import { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Toast } from '../lib/toast';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseImagePickerOptions {
  /** Which picker to open. 'both' shows a source-selection sheet. */
  source?: 'camera' | 'library' | 'both';
  /** Maximum allowed file size in bytes. Defaults to 5 MiB. */
  maxBytes?: number;
  /**
   * Aspect-ratio constraint. `undefined` = free crop; `[1, 1]` = square.
   * When set, the picker opens in editing mode (single-select only).
   */
  aspect?: [number, number];
  /**
   * Allow selecting multiple images from the gallery in one pick() call.
   * Defaults to false. Ignored when source is 'camera' (camera is always
   * single-shot). When true, `onUploadedMany` fires with all succeeded URLs.
   */
  allowsMultipleSelection?: boolean;
  /**
   * Callback that resolves a signed upload URL.
   * The hook stays API-agnostic — the parent screen owns the endpoint logic.
   */
  requestUploadUrl: (args: {
    contentType: string;
    sizeBytes: number;
  }) => Promise<{ uploadUrl: string; blobUrl: string }>;
}

export interface UseImagePickerResult {
  /** Triggers permission prompt → source selection → picker → upload → onUploaded / onUploadedMany. */
  pick: () => Promise<void>;
  /** True while at least one PUT request is in flight. */
  uploading: boolean;
  /**
   * Upload progress in [0, 1].
   * Currently null — React Native fetch does not expose upload progress on
   * all platforms. Exposed in the API so callers can wire it up later without
   * a breaking change (e.g. via XMLHttpRequest or expo-file-system).
   */
  progress: number | null;
  /** Last error, cleared on the next pick() call. */
  error: Error | null;
}

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function getMimeType(uri: string): string | null {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? null;
}

function getFilename(uri: string): string {
  const base = uri.split('?')[0].split('/').pop() ?? 'upload';
  return base;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB

/**
 * @param options       Picker configuration.
 * @param onUploaded    Called with a single blob URL after a single-select upload.
 *                      Pass `undefined` when using multi-select via `onUploadedMany`.
 * @param onUploadedMany Called with the full array of succeeded blob URLs after a
 *                      multi-select pick. Only fires when `allowsMultipleSelection`
 *                      is true. If some uploads fail, the succeeded ones are surfaced
 *                      here and a partial-failure toast is shown.
 */
export function useImagePicker(
  options: UseImagePickerOptions,
  onUploaded: ((blobUrl: string) => void) | undefined,
  onUploadedMany?: (blobUrls: string[]) => void,
): UseImagePickerResult {
  const {
    source = 'both',
    maxBytes = DEFAULT_MAX_BYTES,
    aspect,
    allowsMultipleSelection = false,
    requestUploadUrl,
  } = options;

  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Abort controller so a new pick() can cancel an in-flight upload.
  const abortRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------------------
  // Permission check
  // -------------------------------------------------------------------------

  async function ensurePermissions(
    needCamera: boolean,
  ): Promise<boolean> {
    if (needCamera) {
      const camResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (camResult.status !== 'granted') {
        Toast.show(t('imagePicker.permissionDenied'));
        return false;
      }
    }

    const libResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (libResult.status !== 'granted') {
      Toast.show(t('imagePicker.permissionDenied'));
      return false;
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Source selection (action sheet)
  // -------------------------------------------------------------------------

  function selectSource(): Promise<'camera' | 'library' | 'cancel'> {
    return new Promise((resolve) => {
      const cameraLabel = t('imagePicker.sourceCamera');
      const libraryLabel = t('imagePicker.sourceLibrary');
      const cancelLabel = t('common.cancel');

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [cancelLabel, cameraLabel, libraryLabel],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) resolve('camera');
            else if (buttonIndex === 2) resolve('library');
            else resolve('cancel');
          },
        );
      } else {
        // Android: Alert-based fallback (no new dependency needed).
        Alert.alert(
          t('imagePicker.sourceTitle'),
          undefined,
          [
            { text: cameraLabel, onPress: () => resolve('camera') },
            { text: libraryLabel, onPress: () => resolve('library') },
            {
              text: cancelLabel,
              style: 'cancel',
              onPress: () => resolve('cancel'),
            },
          ],
          { cancelable: true, onDismiss: () => resolve('cancel') },
        );
      }
    });
  }

  // -------------------------------------------------------------------------
  // Picker launch
  // -------------------------------------------------------------------------

  async function launchPicker(
    pickerSource: 'camera' | 'library',
  ): Promise<ImagePicker.ImagePickerResult> {
    // Camera is always single-shot; multi-select applies to library only.
    const multiSelect = allowsMultipleSelection && pickerSource === 'library';

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      // allowsEditing is incompatible with multi-select; disable it when multi.
      allowsEditing: !multiSelect && aspect !== undefined,
      aspect: !multiSelect ? aspect : undefined,
      quality: 0.85,
      allowsMultipleSelection: multiSelect,
    };

    if (pickerSource === 'camera') {
      return ImagePicker.launchCameraAsync(pickerOptions);
    }
    return ImagePicker.launchImageLibraryAsync(pickerOptions);
  }

  // -------------------------------------------------------------------------
  // Size guard
  // -------------------------------------------------------------------------

  async function resolveFileSize(
    asset: ImagePicker.ImagePickerAsset,
  ): Promise<number> {
    // expo-image-picker populates fileSize on device; fall back to fetch.
    if (typeof asset.fileSize === 'number' && asset.fileSize > 0) {
      return asset.fileSize;
    }
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      return blob.size;
    } catch {
      // If we cannot determine the size, let it through and let the server
      // reject oversized files. This is a best-effort client guard.
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // Upload (single asset)
  // -------------------------------------------------------------------------

  async function uploadAsset(
    asset: ImagePicker.ImagePickerAsset,
    contentType: string,
    sizeBytes: number,
    controller: AbortController,
  ): Promise<string> {
    const { uploadUrl, blobUrl } = await requestUploadUrl({
      contentType,
      sizeBytes,
    });

    // React Native supports sending a local-file URI via fetch body.
    // Using a plain object with uri/type/name triggers the RN FormData shim
    // for multipart, but a signed PUT expects the raw binary body instead.
    // We fetch the local file as a blob and PUT it directly.
    const fileResponse = await fetch(asset.uri);
    const blob = await fileResponse.blob();

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
      signal: controller.signal,
    });

    if (!putResponse.ok) {
      throw new Error(
        `Upload failed: ${putResponse.status} ${putResponse.statusText}`,
      );
    }

    return blobUrl;
  }

  // -------------------------------------------------------------------------
  // Upload (single asset, with size + MIME guards)
  // -------------------------------------------------------------------------

  async function prepareAndUpload(
    asset: ImagePicker.ImagePickerAsset,
    controller: AbortController,
  ): Promise<string | null> {
    const contentType = getMimeType(asset.uri);
    if (!contentType) {
      // Skip assets whose extension we cannot map (MIME guard).
      return null;
    }

    const sizeBytes = await resolveFileSize(asset);
    if (sizeBytes > 0 && sizeBytes > maxBytes) {
      // Skip oversized assets (size guard).
      return null;
    }

    return uploadAsset(asset, contentType, sizeBytes, controller);
  }

  // -------------------------------------------------------------------------
  // Main pick() function
  // -------------------------------------------------------------------------

  const pick = useCallback(async (): Promise<void> => {
    setError(null);

    // 1. Determine which source to use.
    let pickerSource: 'camera' | 'library';

    if (source === 'both') {
      const chosen = await selectSource();
      if (chosen === 'cancel') return;
      pickerSource = chosen;
    } else {
      pickerSource = source;
    }

    // 2. Ensure permissions.
    const hasPermissions = await ensurePermissions(pickerSource === 'camera');
    if (!hasPermissions) return;

    // 3. Launch picker.
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await launchPicker(pickerSource);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      Toast.show(t('common.error'));
      return;
    }

    if (result.canceled || result.assets.length === 0) return;

    const multiSelect = allowsMultipleSelection && pickerSource === 'library';

    if (!multiSelect) {
      // ── Single-select path (unchanged behaviour) ──────────────────────────
      const asset = result.assets[0];

      const contentType = getMimeType(asset.uri);
      if (!contentType) {
        Toast.show(t('imagePicker.invalidType'));
        return;
      }

      const sizeBytes = await resolveFileSize(asset);
      if (sizeBytes > 0 && sizeBytes > maxBytes) {
        Toast.show(
          t('imagePicker.oversize', {
            maxMb: (maxBytes / (1024 * 1024)).toFixed(0),
          }),
        );
        return;
      }

      setUploading(true);
      try {
        const filename = getFilename(asset.uri);
        // filename is used for Content-Disposition on some servers; passed
        // implicitly via asset.uri in the blob fetch above.
        void filename; // suppress unused-var lint

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const blobUrl = await uploadAsset(asset, contentType, sizeBytes, controller);
        onUploaded?.(blobUrl);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        Toast.show(t('common.error'));
      } finally {
        setUploading(false);
      }
    } else {
      // ── Multi-select path ─────────────────────────────────────────────────
      const assets = result.assets;

      // Abort any prior upload batch and create one shared controller for
      // this batch. Individual asset failures are caught per-asset below.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setUploading(true);

      // Upload all assets in parallel. Each resolves to a blob URL or null
      // (null = MIME/size guard skipped it, or per-asset upload failure).
      const results = await Promise.all(
        assets.map(async (asset): Promise<string | null> => {
          try {
            return await prepareAndUpload(asset, controller);
          } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') throw e;
            // Per-asset failure: log and treat as null so other uploads
            // can still succeed.
            return null;
          }
        }),
      ).catch((e) => {
        // AbortError from the shared controller propagated out — bail.
        if (e instanceof Error && e.name === 'AbortError') return null;
        throw e;
      });

      setUploading(false);

      if (results === null) {
        // Aborted — no callback.
        return;
      }

      const succeeded = results.filter((url): url is string => url !== null);
      const failCount = assets.length - succeeded.length;

      if (failCount > 0 && succeeded.length > 0) {
        // Partial failure: surface what succeeded, toast the rest.
        Toast.show(
          t('imagePicker.partialUpload', {
            succeeded: succeeded.length,
            total: assets.length,
          }),
        );
      } else if (failCount > 0 && succeeded.length === 0) {
        Toast.show(t('common.error'));
        setError(new Error(`All ${assets.length} uploads failed`));
        return;
      }

      if (succeeded.length > 0) {
        onUploadedMany?.(succeeded);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, maxBytes, aspect, allowsMultipleSelection, requestUploadUrl, onUploaded, onUploadedMany, t]);

  return {
    pick,
    uploading,
    progress: null,
    error,
  };
}

export default useImagePicker;
