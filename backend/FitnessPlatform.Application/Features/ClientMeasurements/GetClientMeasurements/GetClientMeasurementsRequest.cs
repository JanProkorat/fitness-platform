namespace FitnessPlatform.Application.Features.ClientMeasurements.GetClientMeasurements;

/// <summary>
/// Request model for a trainer to retrieve a client's body measurements.
/// </summary>
public class GetClientMeasurementsRequest
{
    /// <summary>
    /// The client profile's public identifier (route parameter).
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Optional start date filter (inclusive).
    /// </summary>
    public DateTime? From { get; set; }

    /// <summary>
    /// Optional end date filter (inclusive).
    /// </summary>
    public DateTime? To { get; set; }

    /// <summary>
    /// Page number (1-based).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
