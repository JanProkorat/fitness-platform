namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Discriminates a row on the trainer's Pending tab, which merges two otherwise-unrelated
/// source tables: unaccepted <c>PendingInvite</c> rows and incoming <c>ClientRequest</c> rows.
/// The client uses this to decide which action to offer (cancel an invite; accept or reject a
/// request) and which existing endpoint to call with the row's <c>PublicId</c>.
/// </summary>
public enum PendingRowKind
{
    /// <summary>Row sourced from <c>PendingInvite</c> — the coach invited this person.</summary>
    Invite,

    /// <summary>Row sourced from <c>ClientRequest</c> — this person asked to join the coach.</summary>
    Request
}
