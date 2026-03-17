namespace FitnessPlatform.Application.Features.Trainers.GetClientProgress;

/// <summary>
/// Request model for retrieving a client's progress data from the trainer's perspective.
/// </summary>
public class GetClientProgressRequest
{
    /// <summary>
    /// The client's ApplicationUser.Id, provided as a route parameter.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Start date for the progress calculation. Defaults to 7 days ago if not provided.
    /// </summary>
    public DateTime? From { get; set; }

    /// <summary>
    /// End date for the progress calculation. Defaults to today if not provided.
    /// </summary>
    public DateTime? To { get; set; }
}
