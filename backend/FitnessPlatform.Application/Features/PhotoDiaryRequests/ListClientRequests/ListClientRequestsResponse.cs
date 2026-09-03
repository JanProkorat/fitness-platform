using FitnessPlatform.Application.Features.PhotoDiaryRequests.Shared;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.ListClientRequests;

/// <summary>
/// Paginated list of photo diary requests visible to the authenticated client.
/// </summary>
public class ListClientRequestsResponse
{
    public List<ClientPhotoDiaryRequestSummary> Items { get; set; } = [];
}
