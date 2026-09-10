using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPlans.FinalizePlanPhoto;

/// <summary>
/// Request model for finalizing a plan photo upload by inserting a <see cref="Domain.Entities.PlanPhoto"/> row.
/// The caller must have already uploaded the photo to blob storage using the URL from
/// POST /client/plans/{planId}/photos/upload-url.
/// </summary>
public class FinalizePlanPhotoRequest
{
    /// <summary>
    /// Route: the plan's public identifier (NutritionPlan.ExternalId or TrainingPlan.ExternalId).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Permanent blob URL returned by the upload-url endpoint.
    /// </summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Display / filtering category (Food / Body / FreeForm).
    /// </summary>
    public PlanPhotoCategory Category { get; set; }

    /// <summary>
    /// Optional caption / description (max 500 chars).
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// When the photo was taken. Defaults to UtcNow when not provided.
    /// </summary>
    public DateTime? TakenAt { get; set; }

    /// <summary>
    /// MongoDB MealLog ObjectId string. Required when <see cref="Category"/> is
    /// <see cref="PlanPhotoCategory.Food"/>, otherwise ignored.
    /// </summary>
    public string? MealLogId { get; set; }

    /// <summary>
    /// Optional diary request ID. When set, the photo is linked to this diary request.
    /// The diary request must be owned by the calling client and must be in
    /// <see cref="Domain.Enums.PhotoDiaryStatus.Accepted"/> or
    /// <see cref="Domain.Enums.PhotoDiaryStatus.InProgress"/> status.
    /// On the first upload for an Accepted request the request is transitioned to InProgress.
    /// </summary>
    public Guid? DiaryRequestId { get; set; }
}
