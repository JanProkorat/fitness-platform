using FitnessPlatform.Application.Features.ClientTags.Shared;

namespace FitnessPlatform.Application.Features.ClientTags.ReplaceClientTagAssignments;

/// <summary>
/// The resulting tag set assigned to the client, for the caller's link.
/// </summary>
public class ReplaceClientTagAssignmentsResponse
{
    /// <summary>
    /// Public identifier of the client the tags were assigned to.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// The tags now assigned, ordered by name.
    /// </summary>
    public List<ClientTagDto> Tags { get; set; } = [];
}
