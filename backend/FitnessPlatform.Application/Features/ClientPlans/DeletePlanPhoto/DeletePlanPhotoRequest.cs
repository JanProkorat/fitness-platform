namespace FitnessPlatform.Application.Features.ClientPlans.DeletePlanPhoto;

/// <summary>
/// Request model for deleting a plan photo by its public identifier.
/// </summary>
public class DeletePlanPhotoRequest
{
    /// <summary>
    /// Route: the photo's public identifier (<see cref="Domain.Entities.PlanPhoto.PublicId"/>).
    /// </summary>
    public Guid PhotoId { get; set; }
}
