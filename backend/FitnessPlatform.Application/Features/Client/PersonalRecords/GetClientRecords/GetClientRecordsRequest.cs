namespace FitnessPlatform.Application.Features.Client.PersonalRecords.GetClientRecords;

/// <summary>
/// Query parameters for listing the authenticated client's personal records.
/// </summary>
public class GetClientRecordsRequest
{
    /// <summary>Page number (1-based). Defaults to 1.</summary>
    public int Page { get; set; } = 1;

    /// <summary>Number of items per page. Defaults to 20; maximum 100.</summary>
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// Optional filter to return records for a specific exercise only.
    /// When null, all exercises are returned.
    /// </summary>
    public Guid? ExerciseExternalId { get; set; }
}
