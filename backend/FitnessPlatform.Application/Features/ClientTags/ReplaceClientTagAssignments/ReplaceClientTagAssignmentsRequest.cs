namespace FitnessPlatform.Application.Features.ClientTags.ReplaceClientTagAssignments;

public class ReplaceClientTagAssignmentsRequest
{
    public Guid ClientId { get; set; }
    public List<Guid> TagIds { get; set; } = [];
}
