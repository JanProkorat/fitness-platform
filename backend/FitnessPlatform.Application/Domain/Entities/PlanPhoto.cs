using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A photo uploaded in the context of a client's plan (nutrition or training).
/// Replaces the retired <c>ProgressPhoto</c> entity and unifies body-progress,
/// food, and free-form plan photos into a single table.
/// </summary>
/// <remarks>
/// <para>
/// <b>Schema decisions:</b>
/// </para>
/// <list type="bullet">
///   <item><c>PlanId</c> is nullable — body and free-form photos that are not
///     tied to a specific plan (e.g. migrated from the legacy <c>progress_photos</c>
///     table when the client had no active plan) are stored without a plan reference.</item>
///   <item><c>PlanType</c> is nullable for the same reason — only meaningful when
///     <c>PlanId</c> is set.</item>
///   <item><c>LinkId</c> is the stable external identifier of the plan document
///     stored in MongoDB (NutritionPlan.ExternalId / TrainingPlan.ExternalId).
///     Nullable for the same reason as <c>PlanId</c>.</item>
///   <item><c>MealLogId</c> links food photos to the specific MongoDB MealLog ObjectId
///     string. Only set when <c>Category == Food</c>.</item>
///   <item><c>DiaryRequestId</c> is reserved for issue #92 (diary-request flow).
///     Nullable, ignored until that issue ships.</item>
/// </list>
/// </remarks>
public class PlanPhoto : PublicTimestampableEntity
{
    /// <summary>
    /// Internal ID of the <see cref="ClientProfile"/> who owns this photo.
    /// </summary>
    public long ClientProfileId { get; set; }

    /// <summary>
    /// External identifier of the linked plan document in MongoDB
    /// (NutritionPlan.ExternalId or TrainingPlan.ExternalId).
    /// Null for body/free-form photos that are not attached to a plan.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Whether this photo belongs to a Nutrition or Training plan context.
    /// Null when <see cref="PlanId"/> is null.
    /// </summary>
    public PlanType? PlanType { get; set; }

    /// <summary>
    /// Stable internal link ID — currently mirrors <see cref="PlanId"/>.
    /// Reserved for future use when a single photo may be referenced across plan versions.
    /// Null when <see cref="PlanId"/> is null.
    /// </summary>
    public Guid? LinkId { get; set; }

    /// <summary>
    /// Display / filtering category of this photo (Food / Body / FreeForm).
    /// </summary>
    public PlanPhotoCategory Category { get; set; }

    /// <summary>
    /// URL to the photo in blob storage (MinIO).
    /// Follows the <c>plan-photos/{planId}/{guid}.{ext}</c> path convention.
    /// </summary>
    [MaxLength(500)]
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>
    /// Optional caption / description for the photo (max 500 chars).
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// MongoDB MealLog ObjectId string to which this photo is attached.
    /// Only set when <see cref="Category"/> is <see cref="PlanPhotoCategory.Food"/>.
    /// </summary>
    [MaxLength(50)]
    public string? MealLogId { get; set; }

    /// <summary>
    /// When the photo was physically taken (or uploaded), in UTC.
    /// </summary>
    public DateTime TakenAt { get; set; }

    /// <summary>
    /// The <c>ApplicationUser.Id</c> of the person who uploaded the photo
    /// (usually the client, but trainers may upload body-check photos on behalf of clients).
    /// </summary>
    public Guid UploadedByUserId { get; set; }

    /// <summary>
    /// Reserved for issue #92 (diary-request flow). Null until that feature ships.
    /// </summary>
    public Guid? DiaryRequestId { get; set; }

    // ── Navigation properties ─────────────────────────────────────────────────

    /// <summary>
    /// Navigation property to the client profile.
    /// </summary>
    public ClientProfile ClientProfile { get; set; } = null!;

    /// <summary>
    /// Navigation property to the user who uploaded the photo.
    /// </summary>
    public ApplicationUser UploadedByUser { get; set; } = null!;
}
