namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.GetAll;

/// <summary>
/// Response model containing a list of pending invitations.
/// </summary>
public class GetPendingInvitesResponse
{
    /// <summary>
    /// List of pending invitations.
    /// </summary>
    public List<PendingInviteDto> Invites { get; set; } = [];
}

/// <summary>
/// DTO representing a single pending invitation.
/// </summary>
public class PendingInviteDto
{
    /// <summary>
    /// Public identifier of the pending invite.
    /// </summary>
    public Guid PublicId { get; set; }

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
    /// Optional introduction message.
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// Timestamp when the invitation was sent.
    /// </summary>
    public DateTime SentAt { get; set; }

    /// <summary>
    /// Whether the invitation has been accepted.
    /// </summary>
    public bool IsAccepted { get; set; }

    /// <summary>
    /// Public ID of the assigned questionnaire, if any.
    /// </summary>
    public Guid? QuestionnairePublicId { get; set; }

    /// <summary>
    /// Title of the assigned questionnaire, if any.
    /// </summary>
    public string? QuestionnaireTitle { get; set; }
}
