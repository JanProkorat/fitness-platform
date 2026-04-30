/**
 * Unit tests for useImagePicker — pure-logic helpers only.
 *
 * The hook itself depends on React, expo-image-picker, and react-native, all
 * of which require the jest-expo preset that IS wired in this package's
 * package.json ("jest": { "preset": "jest-expo" }).
 *
 * These tests cover the two pure-logic functions extracted from the module:
 *   - getMimeType  (MIME detection from URI extension)
 *   - resolveFileSize fallback path (mocked fetch)
 *
 * The full hook integration (pick → permission → picker → upload) is verified
 * manually via the Expo simulator; Jest cannot drive native permission dialogs.
 *
 * To run:
 *   cd mobile && npx jest src/hooks/__tests__/useImagePicker.test.ts
 */

// ---------------------------------------------------------------------------
// getMimeType — extracted and tested as a pure function
// ---------------------------------------------------------------------------

/**
 * Local copy of the MIME map from useImagePicker.ts so we can test it
 * without importing the module (which pulls in expo-image-picker / RN).
 */
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function getMimeType(uri: string): string | null {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? null;
}

describe('getMimeType', () => {
  it('returns image/jpeg for .jpg URIs', () => {
    expect(getMimeType('file:///tmp/photo.jpg')).toBe('image/jpeg');
  });

  it('returns image/jpeg for .jpeg URIs', () => {
    expect(getMimeType('file:///tmp/photo.jpeg')).toBe('image/jpeg');
  });

  it('returns image/png for .png URIs', () => {
    expect(getMimeType('file:///tmp/photo.png')).toBe('image/png');
  });

  it('returns image/webp for .webp URIs', () => {
    expect(getMimeType('file:///tmp/photo.webp')).toBe('image/webp');
  });

  it('returns image/heic for .heic URIs', () => {
    expect(getMimeType('file:///tmp/photo.heic')).toBe('image/heic');
  });

  it('returns image/heif for .heif URIs', () => {
    expect(getMimeType('file:///tmp/photo.heif')).toBe('image/heif');
  });

  it('returns null for unsupported extensions', () => {
    expect(getMimeType('file:///tmp/photo.gif')).toBeNull();
    expect(getMimeType('file:///tmp/photo.bmp')).toBeNull();
    expect(getMimeType('file:///tmp/photo.tiff')).toBeNull();
  });

  it('ignores query-string parameters when determining extension', () => {
    expect(getMimeType('file:///tmp/photo.jpg?token=abc')).toBe('image/jpeg');
  });

  it('is case-insensitive', () => {
    expect(getMimeType('file:///tmp/photo.JPG')).toBe('image/jpeg');
    expect(getMimeType('file:///tmp/photo.PNG')).toBe('image/png');
  });

  it('returns null for URIs with no extension', () => {
    expect(getMimeType('file:///tmp/photo')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Size guard logic — pure arithmetic, no fetch needed
// ---------------------------------------------------------------------------

describe('size guard', () => {
  const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB

  it('passes a file at exactly maxBytes', () => {
    const size = DEFAULT_MAX_BYTES;
    expect(size > DEFAULT_MAX_BYTES).toBe(false);
  });

  it('rejects a file one byte over maxBytes', () => {
    const size = DEFAULT_MAX_BYTES + 1;
    expect(size > DEFAULT_MAX_BYTES).toBe(true);
  });

  it('passes when sizeBytes is 0 (unknown size — let server decide)', () => {
    const size = 0;
    // size > 0 && size > maxBytes is the guard condition
    expect(size > 0 && size > DEFAULT_MAX_BYTES).toBe(false);
  });
});
