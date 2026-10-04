namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// Request body for creating a new photo diary request.
/// Exactly one of <see cref="ClientId"/> or <see cref="PendingInviteId"/> must be set.
/// </summary>
public class CreateRequestRequest
{
    /// <summary>
    /// Public identifier of the client (<c>ClientProfile.PublicId</c>) this request targets,
    /// resolved server-side to the caller's own active link. Mutually exclusive with
    /// <see cref="PendingInviteId"/>.
    /// </summary>
    public Guid? ClientId { get; set; }

    /// <summary>
    /// Internal ID of a pending invite. Mutually exclusive with <see cref="ClientId"/>.
    /// Deliberately left as the internal <c>long</c> primary key, unlike <see cref="ClientId"/>:
    /// a pending invite has no client-facing identity yet — no <c>ClientProfile</c> exists until
    /// the invite is accepted — so there is no public <c>Guid</c> to address it by. Widening this
    /// arm to a public identifier is a separate, undecided change and knowingly out of scope here.
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
