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
    /// The MinIO blob URL for this photo.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

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
