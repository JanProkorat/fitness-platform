using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.AcceptClientRequest;

/// <summary>
/// Request model for accepting a client request.
/// </summary>
public class AcceptClientRequestRequest
{
    /// <summary>
    /// Public identifier of the client request (from route).
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>
    /// Optional public ID of a questionnaire to assign to the client upon acceptance.
    /// </summary>
    public Guid? QuestionnairePublicId { get; set; }

    /// <summary>
    /// Optional statement from the professional (saved for future display in chat).
    /// </summary>
    public string? Statement { get; set; }

    /// <summary>
    /// Optional explicit domain scope for the resulting client-professional link. When
    /// omitted, defaults to every domain implied by the caller's held identity roles
    /// (existing behavior — unchanged). When supplied, it must be a subset of the
    /// caller's actually-held roles; e.g. a Trainer-only professional cannot request
    /// <see cref="LinkCapabilityScope.NutritionOnly"/>.
    /// </summary>
    public LinkCapabilityScope? RequestedScope { get; set; }
}
