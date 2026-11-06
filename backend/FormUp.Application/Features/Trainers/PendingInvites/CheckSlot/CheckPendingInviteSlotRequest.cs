namespace FormUp.Application.Features.Trainers.PendingInvites.CheckSlot;

/// <summary>
/// Query for the live profession-slot check of an invitee email.
/// </summary>
public class CheckPendingInviteSlotRequest
{
    /// <summary>Query parameter — the invitee's email address.</summary>
    public string Email { get; set; } = string.Empty;
}
