using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.ListClientRequests;

/// <summary>
/// Summary DTO for a photo diary request in the client list view.
/// </summary>
public class ClientPhotoDiaryRequestSummary
{
    public Guid Id { get; set; }
    public Guid ProfessionalId { get; set; }
    public long? LinkId { get; set; }
    public long? PendingInviteId { get; set; }
    public Guid? PlanId { get; set; }
    public int DurationDays { get; set; }
    public PhotoDiaryMode? Mode { get; set; }
    public PhotoDiaryStatus Status { get; set; }
    public string? DismissReason { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// Paginated list of photo diary requests visible to the authenticated client.
/// </summary>
public class ListClientRequestsResponse
{
    public List<ClientPhotoDiaryRequestSummary> Items { get; set; } = [];
}
