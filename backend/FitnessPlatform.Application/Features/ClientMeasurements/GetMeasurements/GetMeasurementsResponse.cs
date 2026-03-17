using FitnessPlatform.Application.Features.ClientMeasurements.Shared;

namespace FitnessPlatform.Application.Features.ClientMeasurements.GetMeasurements;

/// <summary>
/// Paginated response containing body measurement records.
/// </summary>
public class GetMeasurementsResponse
{
    /// <summary>
    /// List of measurement records for the current page.
    /// </summary>
    public List<MeasurementDto> Items { get; set; } = [];

    /// <summary>
    /// Total number of matching records.
    /// </summary>
    public int TotalCount { get; set; }

    /// <summary>
    /// Current page number.
    /// </summary>
    public int Page { get; set; }

    /// <summary>
    /// Number of items per page.
    /// </summary>
    public int PageSize { get; set; }
}
