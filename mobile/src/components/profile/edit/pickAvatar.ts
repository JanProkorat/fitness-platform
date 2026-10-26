import * as ImagePicker from 'expo-image-picker';

import type { AvatarAsset } from '@/api/avatar';

const FALLBACK_MIME_TYPE = 'image/jpeg';

/**
 * Opens the photo library for a square crop and returns the chosen photo, or `null` when the
 * user cancels. Quality below 1 keeps the file well under the 5 MiB upload limit.
 */
export async function pickAvatar(): Promise<AvatarAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, mimeType: asset.mimeType ?? FALLBACK_MIME_TYPE };
}
