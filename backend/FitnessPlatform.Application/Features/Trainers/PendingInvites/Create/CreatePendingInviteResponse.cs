namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;

/// <summary>
/// Response model returned after creating a pending invitation.
/// </summary>
public class CreatePendingInviteResponse
{
    /// <summary>
    /// Public identifier of the created pending invite.
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
    /// Timestamp when the invitation was sent.
    /// </summary>
    public DateTime SentAt { get; set; }
}
