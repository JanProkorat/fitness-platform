/**
 * YouTube link detection for message bubbles (#1095). Video is never
 * stored — every video shared in a chat message is a plain YouTube URL in
 * the message text, and the thread renders a preview card from the link
 * (docs/design/1095/inbox-inventory.md). A non-YouTube URL, or a
 * YouTube-looking URL whose video id fails the 11-character id shape,
 * renders as plain text/an anchor — never guessed at.
 */

/** YouTube video ids are always exactly 11 base64url-safe characters. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTNAMES = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);

/** First `http(s)://` URL found in free text, or null if there isn't one. */
export function findFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

/**
 * Extracts a validated YouTube video id from a URL, or null if the URL
 * isn't a recognised YouTube link shape, or the candidate id doesn't match
 * the 11-character id pattern. Validated **before** any thumbnail/watch URL
 * is built from it — never interpolate an unvalidated candidate into a URL.
 */
export function extractYouTubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!YOUTUBE_HOSTNAMES.has(parsed.hostname)) {
    return null;
  }

  let candidate: string | null = null;
  if (parsed.hostname.endsWith('youtu.be')) {
    candidate = parsed.pathname.slice(1);
  } else if (parsed.pathname === '/watch') {
    candidate = parsed.searchParams.get('v');
  } else if (parsed.pathname.startsWith('/embed/')) {
    candidate = parsed.pathname.slice('/embed/'.length);
  } else if (parsed.pathname.startsWith('/shorts/')) {
    candidate = parsed.pathname.slice('/shorts/'.length);
  }

  if (!candidate || !YOUTUBE_ID_PATTERN.test(candidate)) {
    return null;
  }

  return candidate;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Removes the matched URL from a message's text so the preview card's
 * caption reads as a title rather than repeating the raw link, then trims
 * any punctuation/whitespace the URL leaves dangling (e.g. a trailing
 * "check this out: "). Returns an empty string when the message was
 * nothing but the URL, so the caller falls back to the video label alone.
 */
export function stripUrlFromCaption(text: string, url: string): string {
  return text
    .replace(url, '')
    .trim()
    .replace(/[\s:,;.-]+$/, '')
    .trim();
}
