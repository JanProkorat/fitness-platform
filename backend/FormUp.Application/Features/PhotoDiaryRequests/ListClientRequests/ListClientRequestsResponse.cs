using FormUp.Application.Features.PhotoDiaryRequests.Shared;

namespace FormUp.Application.Features.PhotoDiaryRequests.ListClientRequests;

/// <summary>
/// Paginated list of photo diary requests visible to the authenticated client.
/// </summary>
public class ListClientRequestsResponse
{
    public List<ClientPhotoDiaryRequestSummary> Items { get; set; } = [];
}
