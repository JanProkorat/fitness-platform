namespace FitnessPlatform.Application.Features.Client.Progress.GetComplianceScore;

/// <summary>
/// Request model for retrieving a client's compliance score.
/// </summary>
public class GetComplianceScoreRequest
{
    /// <summary>
    /// Start date for the compliance calculation. Defaults to 7 days ago if not provided.
    /// </summary>
    public DateTime? From { get; set; }

    /// <summary>
    /// End date for the compliance calculation. Defaults to today if not provided.
    /// </summary>
    public DateTime? To { get; set; }
}
