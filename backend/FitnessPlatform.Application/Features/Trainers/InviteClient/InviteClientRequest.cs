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
}
