using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.ListClientRequests;

/// <summary>
/// Query parameters for the client's photo diary request list.
/// </summary>
public class ListClientRequestsRequest
{
    /// <summary>Page number (1-based). Defaults to 1.</summary>
    public int Page { get; set; } = 1;

    /// <summary>Number of items per page. Defaults to 20.</summary>
    public int PageSize { get; set; } = 20;

    /// <summary>Optional filter by status.</summary>
    public PhotoDiaryStatus? Status { get; set; }

    /// <summary>Optional filter by plan ID.</summary>
    public Guid? PlanId { get; set; }
}
