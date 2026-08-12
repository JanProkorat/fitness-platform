using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPlans;

/// <summary>
/// Response shape for a single <see cref="Domain.Entities.PlanPhoto"/> record.
/// Shared across the FinalizePlanPhoto and GetPlanPhotos slices within the
/// ClientPlans feature area — both surfaces expose the same projection.
/// </summary>
public class PlanPhotoResponse
{
    /// <summary>
    /// Public identifier of the photo record.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Canonical, permanent blob storage identity for the photo. NOT directly fetchable for
    /// client-photo prefixes (the bucket carries no public-read grant there) — this is the
    /// write-path identity key, safe to echo back unchanged on a subsequent save. Never render
    /// this as an <c>&lt;img&gt;</c>/<c>Image</c> source; use <see cref="DisplayUrl"/> instead.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Short-lived pre-signed GET URL for actually fetching the photo bytes. Expires after
    /// <c>MinIO:ReadUrlExpiryMinutes</c> (default 15 minutes) — presentation-only, re-fetch
    /// rather than persisting, caching, or echoing it back on a write. Never conflate this with
    /// <see cref="BlobUrl"/>: a client that submits this value back on a save would permanently
    /// store an expiring signature (F9 follow-up).
    /// </summary>
    public string DisplayUrl { get; set; } = string.Empty;

    /// <summary>
    /// Display / filtering category (Food / Body / FreeForm).
    /// </summary>
    public PlanPhotoCategory Category { get; set; }

    /// <summary>
    /// Optional caption.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// When the photo was taken (or uploaded), in UTC.
    /// </summary>
    public DateTime TakenAt { get; set; }

    /// <summary>
    /// MongoDB MealLog ObjectId string for food photos. Null for non-food photos.
    /// </summary>
    public string? MealLogId { get; set; }

    /// <summary>
    /// External plan identifier this photo belongs to.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Whether this is a nutrition or training plan photo.
    /// </summary>
    public PlanPhotoType? PlanType { get; set; }

    /// <summary>
    /// When the record was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// The ApplicationUser.Id of the uploader.
    /// </summary>
    public Guid UploadedByUserId { get; set; }

    /// <summary>
    /// The diary request this photo is associated with, or null if none.
    /// </summary>
    public Guid? DiaryRequestId { get; set; }
}
