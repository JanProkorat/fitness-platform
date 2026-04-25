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
    /// Permanent blob URL for the photo.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

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
}
