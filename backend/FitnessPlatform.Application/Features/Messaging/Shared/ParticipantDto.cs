namespace FitnessPlatform.Application.Features.Messaging.Shared;

/// <summary>
/// The other party in a conversation, as surfaced to the caller.
/// </summary>
public class ParticipantDto
{
    /// <summary>The participant's <c>ApplicationUser.Id</c>.</summary>
    public Guid Id { get; set; }

    /// <summary>The participant's display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Two-letter initials fallback for the avatar badge.</summary>
    public string Initials { get; set; } = string.Empty;

    /// <summary>Whether the participant currently has a live SignalR connection.</summary>
    public bool Online { get; set; }

    /// <summary>
    /// Avatar URL for the participant. For professionals, prefers the professional-profile
    /// avatar; falls back to the user-level avatar. For clients, uses the user-level avatar.
    /// Null when neither has been uploaded.
    /// </summary>
    public string? AvatarBlobUrl { get; set; }

    /// <summary>
    /// The client participant's <c>ClientProfile.PublicId</c>. Null when the participant is a
    /// professional (a professional-side conversation row has no client-profile identity to
    /// surface). Lets the inbox deep-link to <c>/clients/:clientId</c> without a second lookup.
    /// </summary>
    public Guid? ClientPublicId { get; set; }
}
