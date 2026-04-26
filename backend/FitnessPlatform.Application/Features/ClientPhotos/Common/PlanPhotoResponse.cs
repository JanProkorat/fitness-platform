using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPhotos.Common;

/// <summary>
/// DTO representing a single plan photo returned by the aggregation endpoints.
/// Used by both the trainer view (<c>GET /trainer/clients/{id}/photos</c>)
/// and the client self-view (<c>GET /client/me/photos</c>).
/// </summary>
public class PlanPhotoResponse
{
    /// <summary>
    /// Public identifier of the photo record.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// URL to the photo in blob storage (MinIO).
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

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
    /// Maps a <see cref="PlanPhoto"/> entity to a <see cref="PlanPhotoResponse"/>.
    /// </summary>
    public static PlanPhotoResponse FromEntity(PlanPhoto p) => new()
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
    };
}
