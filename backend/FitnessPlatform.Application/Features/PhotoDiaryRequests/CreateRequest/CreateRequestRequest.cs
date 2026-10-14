using FitnessPlatform.Application.Domain.Enums;

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
    /// When set, must have been created by the caller (and, on the link path, belong to the same client).
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>
    /// How the client uploads: <c>Bulk</c> is "Once", <c>Workflow</c> is "Every day". Required.
    /// </summary>
    public PhotoDiaryMode Mode { get; set; }

    /// <summary>
    /// How many days the request stays open in <c>Workflow</c> mode. Defaults to 7; allowed range 1–30.
    /// Ignored for <c>Bulk</c>, which always stores 1.
    /// </summary>
    public int DurationDays { get; set; } = 7;

    /// <summary>Optional note shown to the client (max 500 characters).</summary>
    public string? Message { get; set; }
}
