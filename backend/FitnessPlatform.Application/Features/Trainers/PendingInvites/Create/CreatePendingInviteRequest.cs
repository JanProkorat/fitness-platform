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
}
