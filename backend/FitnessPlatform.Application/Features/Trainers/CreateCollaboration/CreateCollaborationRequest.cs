namespace FitnessPlatform.Application.Features.Trainers.CreateCollaboration;

/// <summary>
/// Request model for creating a collaboration between a trainer and another professional for a shared client.
/// </summary>
public class CreateCollaborationRequest
{
    /// <summary>
    /// The public ID of the client to share with the collaborator.
    /// </summary>
    public Guid ClientPublicId { get; set; }

    /// <summary>
    /// The public ID of the collaborator's <see cref="Domain.Entities.ProfessionalProfile"/>.
    /// </summary>
    public Guid CollaboratorPublicId { get; set; }
}
