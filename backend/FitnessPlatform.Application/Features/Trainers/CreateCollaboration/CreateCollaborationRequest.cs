using FitnessPlatform.Application.Domain.Enums;

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

    /// <summary>
    /// Optional explicit domain scope for the collaborator's new link. When omitted,
    /// defaults to every domain implied by the collaborator's held identity roles
    /// (existing behavior — unchanged). When supplied, it must be a subset of the
    /// collaborator's actually-held roles; e.g. a Trainer-only collaborator cannot be
    /// granted <see cref="LinkCapabilityScope.NutritionOnly"/>.
    /// </summary>
    public LinkCapabilityScope? RequestedScope { get; set; }
}
