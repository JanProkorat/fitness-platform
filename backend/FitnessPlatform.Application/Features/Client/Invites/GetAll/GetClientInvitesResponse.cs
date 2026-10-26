using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Client.Invites.GetAll;

/// <summary>
/// The caller's pending invitations, newest first.
/// </summary>
public class GetClientInvitesResponse
{
    /// <summary>Pending, unexpired invitations addressed to the caller.</summary>
    public List<ClientInviteDto> Items { get; set; } = [];
}

/// <summary>
/// One pending invitation from a professional.
/// </summary>
public class ClientInviteDto
{
    /// <summary>Public id of the invite.</summary>
    public Guid Id { get; set; }

    /// <summary>Public id of the inviting professional's profile.</summary>
    public Guid CoachPublicId { get; set; }

    /// <summary>Full name of the inviting professional.</summary>
    public string CoachName { get; set; } = string.Empty;

    /// <summary>Roles the professional holds, joined for display (e.g. "Trainer &amp; Nutritionist").</summary>
    public string CoachRole { get; set; } = string.Empty;

    /// <summary>City of the professional, or empty when unset.</summary>
    public string CoachCity { get; set; } = string.Empty;

    /// <summary>Collaboration type accepting would grant now, or null when it would grant nothing.</summary>
    public LinkCapabilityScope? OfferedType { get; set; }

    /// <summary>Optional introduction message.</summary>
    public string? Message { get; set; }

    /// <summary>When the invitation was sent (UTC).</summary>
    public DateTime SentAt { get; set; }

    /// <summary>When the invitation stops being answerable (UTC).</summary>
    public DateTime ExpiresAt { get; set; }
}
