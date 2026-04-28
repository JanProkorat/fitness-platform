namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// Request body for creating a new photo diary request.
/// Exactly one of <see cref="LinkId"/> or <see cref="PendingInviteId"/> must be set.
/// </summary>
public class CreateRequestRequest
{
    /// <summary>
    /// Internal ID of an existing client-professional link.
    /// Mutually exclusive with <see cref="PendingInviteId"/>.
    /// </summary>
    public long? LinkId { get; set; }

    /// <summary>
    /// Internal ID of a pending invite.
    /// Mutually exclusive with <see cref="LinkId"/>.
    /// </summary>
    public long? PendingInviteId { get; set; }

    /// <summary>
    /// Optional MongoDB external identifier of the nutrition or training plan this request is scoped to.
    /// When set, must belong to the same client as the link/invite.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// How many days the client has to upload photos (Workflow mode).
    /// Defaults to 7. Allowed range: 1–30.
    /// </summary>
    public int DurationDays { get; set; } = 7;
}
