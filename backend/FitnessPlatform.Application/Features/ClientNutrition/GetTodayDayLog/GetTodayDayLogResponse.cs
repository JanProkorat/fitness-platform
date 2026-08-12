namespace FitnessPlatform.Application.Features.ClientNutrition.GetTodayDayLog;

/// <summary>
/// Response model for the client's day-level diary log for today.
/// </summary>
public class GetTodayDayLogResponse
{
    /// <summary>
    /// Plan-level photos attached to today's day log.
    /// Empty when no photos have been uploaded for today.
    /// </summary>
    public List<DayPhotoDto> Photos { get; set; } = [];

    /// <summary>
    /// Optional day-level note. Null when none was provided.
    /// </summary>
    public string? Note { get; set; }
}

/// <summary>
/// DTO for a single day-level photo reference in a day log response.
/// </summary>
public class DayPhotoDto
{
    /// <summary>
    /// Canonical, permanent blob storage identity for the photo. NOT directly fetchable — the
    /// bucket carries no public-read grant for this prefix. This is the write-path identity key,
    /// safe to echo back unchanged on a subsequent SaveDayPhotos call. Never render this as an
    /// <c>&lt;img&gt;</c>/<c>Image</c> source; use <see cref="DisplayUrl"/> instead.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Short-lived pre-signed GET URL for actually fetching the photo bytes. Expires after
    /// <c>MinIO:ReadUrlExpiryMinutes</c> (default 15 minutes) — presentation-only, re-fetch
    /// rather than persisting, caching, or echoing it back on a write. Never conflate this with
    /// <see cref="BlobUrl"/>: submitting this value back to SaveDayPhotos would permanently
    /// store an expiring signature (F9 follow-up).
    /// </summary>
    public string DisplayUrl { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the photo was uploaded.
    /// </summary>
    public DateTime UploadedAt { get; set; }

    /// <summary>
    /// Optional per-photo caption set by the client when saving photos.
    /// Null when no caption was provided for this photo.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Display category string (Food / Progress / Free).
    /// </summary>
    public string Category { get; set; } = "Free";
}
