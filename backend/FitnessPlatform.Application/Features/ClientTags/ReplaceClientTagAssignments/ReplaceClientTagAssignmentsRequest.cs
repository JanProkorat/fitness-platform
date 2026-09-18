namespace FitnessPlatform.Application.Features.ClientTags.ReplaceClientTagAssignments;

/// <summary>
/// Request body for replacing the full set of tags assigned to a client. <c>ClientId</c> is bound
/// from the route.
/// </summary>
public class ReplaceClientTagAssignmentsRequest
{
    /// <summary>
    /// Public identifier of the client, from the route.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Public identifiers of the tags to assign. An empty list clears every assignment for the
    /// caller's link to this client.
    /// </summary>
    public List<Guid> TagIds { get; set; } = [];
}
