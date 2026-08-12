using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPhotos.Common;

/// <summary>
/// DTO representing a single plan photo returned by the aggregation endpoints.
/// Used by both the trainer view (<c>GET /trainer/clients/{id}/photos</c>)
/// and the client self-view (<c>GET /client/me/photos</c>).
/// </summary>
public class ClientPhotoResponse
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
    /// Optional caption or description for the photo.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Display / filtering category (Food / Body / FreeForm).
    /// </summary>
    public PlanPhotoCategory Category { get; set; }

    /// <summary>
    /// External identifier of the linked plan document in MongoDB.
    /// Null for photos not attached to a plan.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Whether this photo belongs to a Nutrition or Training plan context.
    /// Null when <see cref="PlanId"/> is null.
    /// </summary>
    public PlanPhotoType? PlanType { get; set; }

    /// <summary>
    /// MongoDB MealLog ObjectId string. Only set when <see cref="Category"/> is Food.
    /// </summary>
    public string? MealLogId { get; set; }

    /// <summary>
    /// When the photo was taken or uploaded, in UTC.
    /// </summary>
    public DateTime TakenAt { get; set; }

    /// <summary>
    /// The <c>ApplicationUser.Id</c> of the person who uploaded the photo.
    /// </summary>
    public Guid UploadedByUserId { get; set; }

    /// <summary>
    /// When the record was created (upload timestamp), in UTC.
    /// </summary>
    public DateTime UploadedAt { get; set; }

    /// <summary>
    /// The diary request this photo is associated with, or null if none.
    /// </summary>
    public Guid? DiaryRequestId { get; set; }

    /// <summary>
    /// Maps a <see cref="PlanPhoto"/> entity to a <see cref="ClientPhotoResponse"/>.
    /// </summary>
    public static ClientPhotoResponse FromEntity(PlanPhoto p) => new()
    {
        Id = p.PublicId,
        BlobUrl = p.BlobUrl,
        Description = p.Description,
        Category = p.Category,
        PlanId = p.PlanId,
        PlanType = p.PlanType,
        MealLogId = p.MealLogId,
        TakenAt = p.TakenAt,
        UploadedByUserId = p.UploadedByUserId,
        UploadedAt = p.DateCreated,
        DiaryRequestId = p.DiaryRequestId,
    };
}
