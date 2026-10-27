namespace FitnessPlatform.Application.Features.Client.Collaborations.End;

/// <summary>
/// Request for ending a collaboration.
/// </summary>
public class EndCollaborationRequest
{
    /// <summary>Route parameter — public id of the client-professional link to end.</summary>
    public Guid PublicId { get; set; }
}
