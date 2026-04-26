namespace FitnessPlatform.Application.Features.ClientPhotos.Common;

/// <summary>
/// Represents a calendar-month bucket of plan photos returned when
/// <c>groupByMonth=true</c> is passed to the aggregation endpoints.
/// </summary>
public class MonthGroupResponse
{
    /// <summary>
    /// ISO-8601 year-month key derived from <see cref="PlanPhotoResponse.TakenAt"/>,
    /// e.g. <c>"2026-04"</c>.
    /// </summary>
    public string YearMonth { get; set; } = string.Empty;

    /// <summary>
    /// All photos whose <c>TakenAt</c> falls within this year-month, ordered by
    /// <c>TakenAt</c> descending.
    /// </summary>
    public List<PlanPhotoResponse> Photos { get; set; } = [];
}
