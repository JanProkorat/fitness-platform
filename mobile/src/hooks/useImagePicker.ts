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
 *
 * Usage:
 *   const { pick, uploading, progress, error } = useImagePicker(
 *     { source: 'both', requestUploadUrl },
 *     (blobUrl) => console.log('uploaded to', blobUrl),
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
   * When set, the picker opens in editing mode.
   */
  aspect?: [number, number];
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
  /** Triggers permission prompt → source selection → picker → upload → onUploaded. */
  pick: () => Promise<void>;
  /** True while the PUT request is in flight. */
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

export function useImagePicker(
  options: UseImagePickerOptions,
  onUploaded: (blobUrl: string) => void,
): UseImagePickerResult {
  const {
    source = 'both',
    maxBytes = DEFAULT_MAX_BYTES,
    aspect,
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
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: aspect !== undefined,
      aspect,
      quality: 0.85,
      allowsMultipleSelection: false,
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
  // Upload
  // -------------------------------------------------------------------------

  async function uploadAsset(
    asset: ImagePicker.ImagePickerAsset,
    contentType: string,
    sizeBytes: number,
  ): Promise<string> {
    const { uploadUrl, blobUrl } = await requestUploadUrl({
      contentType,
      sizeBytes,
    });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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

    const asset = result.assets[0];

    // 4. MIME check.
    const contentType = getMimeType(asset.uri);
    if (!contentType) {
      Toast.show(t('imagePicker.invalidType'));
      return;
    }

    // 5. Size guard.
    const sizeBytes = await resolveFileSize(asset);
    if (sizeBytes > 0 && sizeBytes > maxBytes) {
      Toast.show(
        t('imagePicker.oversize', {
          maxMb: (maxBytes / (1024 * 1024)).toFixed(0),
        }),
      );
      return;
    }

    // 6. Upload.
    setUploading(true);
    try {
      const filename = getFilename(asset.uri);
      // filename is used for Content-Disposition on some servers; passed
      // implicitly via asset.uri in the blob fetch above.
      void filename; // suppress unused-var lint
      const blobUrl = await uploadAsset(asset, contentType, sizeBytes);
      onUploaded(blobUrl);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      Toast.show(t('common.error'));
    } finally {
      setUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, maxBytes, aspect, requestUploadUrl, onUploaded, t]);

  return {
    pick,
    uploading,
    progress: null,
    error,
  };
}

export default useImagePicker;
