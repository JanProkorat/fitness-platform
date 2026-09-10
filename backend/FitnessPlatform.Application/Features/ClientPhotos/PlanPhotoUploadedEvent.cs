using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientPlans;

/// <summary>
/// Payload for the <c>planPhotoUploaded</c> SignalR event broadcast to the owning professional
/// whenever a <see cref="Domain.Entities.PlanPhoto"/> row is created.
/// </summary>
public class PlanPhotoUploadedEvent
{
    /// <summary>
    /// The plan the photo belongs to (NutritionPlan.ExternalId or TrainingPlan.ExternalId).
    /// Null for body photos not attached to a specific plan.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// The public identifier of the newly created <see cref="Domain.Entities.PlanPhoto"/> row.
    /// </summary>
    public Guid PhotoId { get; set; }

    /// <summary>
    /// Display / filtering category of this photo (Food / Body / FreeForm).
    /// </summary>
    public PlanPhotoCategory Category { get; set; }

    /// <summary>
    /// When the photo was taken or uploaded, in UTC.
    /// </summary>
    public DateTime TakenAt { get; set; }
}
