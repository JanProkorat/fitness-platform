import * as ImageManipulator from 'expo-image-manipulator';

const HEIF_RE = /\.(heic|heif)(\?|$)/i;

/**
 * If the given local URI is a HEIC or HEIF file, convert it to JPEG and return
 * the new URI. Otherwise returns the URI unchanged.
 *
 * Why this exists: browsers (Chrome, Firefox, Safari) cannot render HEIC/HEIF
 * in `<img>` tags natively. iPhones default to HEIC for camera output, so
 * without transcoding the trainer portal would see broken-image icons for
 * every photo a client uploads from their iOS camera. Doing the conversion
 * on-device (before the signed PUT) keeps blob storage in browser-friendly
 * formats and avoids any server-side libheif dependency.
 *
 * Quality is set to 0.85 — matches the picker's default compression level.
 */
export async function transcodeHeicToJpeg(uri: string): Promise<string> {
  if (!HEIF_RE.test(uri)) return uri;
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [],
    {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.85,
    },
  );
  return result.uri;
}
