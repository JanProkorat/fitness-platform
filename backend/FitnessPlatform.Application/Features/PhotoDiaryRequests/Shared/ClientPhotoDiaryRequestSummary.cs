using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.Shared;

/// <summary>
/// Summary DTO for a photo diary request in the client-facing views (list and get-by-id).
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
