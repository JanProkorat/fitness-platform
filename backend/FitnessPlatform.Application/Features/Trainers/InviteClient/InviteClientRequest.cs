using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.InviteClient;

/// <summary>
/// Request model for inviting a client via email.
/// </summary>
public class InviteClientRequest
{
    /// <summary>
    /// Email address of the client to invite.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Optional explicit domain scope for the relationship this invitation will form.
    /// When omitted, the accept flow defaults to every domain implied by the inviting
    /// professional's held identity roles (existing behavior — unchanged). When
    /// supplied, it must be a subset of the professional's actually-held roles; e.g. a
    /// Trainer-only professional cannot request <see cref="LinkCapabilityScope.NutritionOnly"/>.
    /// </summary>
    public LinkCapabilityScope? RequestedScope { get; set; }
}
