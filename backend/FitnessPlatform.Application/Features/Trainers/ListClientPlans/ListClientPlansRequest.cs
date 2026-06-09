namespace FitnessPlatform.Application.Features.Trainers.ListClientPlans;

public class ListClientPlansRequest
{
    /// <summary>
    /// The client's PublicId (Guid), as it appears in the route segment.
    /// </summary>
    public Guid ClientId { get; set; }
}
