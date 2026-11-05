namespace FormUp.Application.Features.Questionnaires.MarkClientFormSeen;

/// <summary>
/// Request for marking a submitted form as seen by the coach.
/// </summary>
public class MarkClientFormSeenRequest
{
    /// <summary>Route parameter — public id of the client.</summary>
    public Guid ClientPublicId { get; set; }

    /// <summary>Route parameter — public id of the response.</summary>
    public Guid ResponsePublicId { get; set; }
}
