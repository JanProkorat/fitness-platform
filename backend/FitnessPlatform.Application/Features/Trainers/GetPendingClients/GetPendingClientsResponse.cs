using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.GetPendingClients;

/// <summary>
/// Response model for the trainer's Pending tab.
/// </summary>
public class GetPendingClientsResponse
{
    /// <summary>
    /// Merged, unpaginated rows — unaccepted invites plus incoming pending requests, ordered by
    /// <see cref="PendingClientRow.SentAt"/> descending.
    /// </summary>
    public List<PendingClientRow> Rows { get; set; } = [];
}

/// <summary>
/// A single Pending-tab row. <see cref="Kind"/> tells the client which existing action endpoint
/// to call with <see cref="PublicId"/> — cancel an invite, or accept/reject a request.
/// </summary>
public class PendingClientRow
{
    /// <summary>Which source table this row came from.</summary>
    public PendingRowKind Kind { get; set; }

    /// <summary>
    /// Public identifier of the source row — <c>PendingInvite.PublicId</c> for
    /// <see cref="PendingRowKind.Invite"/>, <c>ClientRequest.PublicId</c> for
    /// <see cref="PendingRowKind.Request"/>. This is the id the row's action endpoint expects.
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>First name of the prospective client.</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Last name of the prospective client.</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>Email address of the prospective client.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Optional message attached to the invite or request.</summary>
    public string? Message { get; set; }

    /// <summary>When the invite was sent, or the request was submitted.</summary>
    public DateTime SentAt { get; set; }
}
