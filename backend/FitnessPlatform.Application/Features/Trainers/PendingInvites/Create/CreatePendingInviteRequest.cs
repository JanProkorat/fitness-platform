using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;

/// <summary>
/// Request model for creating a pending client invitation.
/// </summary>
public class CreatePendingInviteRequest
{
    /// <summary>
    /// First name of the invited client.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Last name of the invited client.
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Email address of the invited client.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Optional introduction message from the professional.
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// Optional public ID of a questionnaire to assign to the client.
    /// </summary>
    public Guid? QuestionnairePublicId { get; set; }

    /// <summary>
    /// Optional explicit domain scope for the relationship this invitation will form.
    /// When omitted, the accept flow defaults to every domain implied by the inviting
    /// professional's held identity roles (existing behavior — unchanged). When
    /// supplied, it must be a subset of the professional's actually-held roles; e.g. a
    /// Trainer-only professional cannot request <see cref="LinkCapabilityScope.NutritionOnly"/>.
    /// </summary>
    public LinkCapabilityScope? RequestedScope { get; set; }
}
