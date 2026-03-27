namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Delete;

/// <summary>
/// Request model for deleting a pending invitation.
/// </summary>
public class DeletePendingInviteRequest
{
    /// <summary>
    /// Public identifier of the pending invite to delete (bound from route).
    /// </summary>
    public string Id { get; set; } = string.Empty;
}
