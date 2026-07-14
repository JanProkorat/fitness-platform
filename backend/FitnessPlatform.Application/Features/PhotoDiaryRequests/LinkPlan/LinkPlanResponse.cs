using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.LinkPlan;

/// <summary>
/// Response body returned after retroactively linking a photo diary request to a plan.
/// </summary>
public class LinkPlanResponse
{
    /// <summary>The photo diary request's ID.</summary>
    public Guid Id { get; set; }

    /// <summary>The professional (nutritionist/trainer) who owns this request.</summary>
    public Guid ProfessionalId { get; set; }

    /// <summary>The client-professional link this request is attached to (if link-based).</summary>
    public long? LinkId { get; set; }

    /// <summary>The pending invite this request is bundled with (if invite-based).</summary>
    public long? PendingInviteId { get; set; }

    /// <summary>The plan now linked to this request.</summary>
    public Guid? PlanId { get; set; }

    /// <summary>How many days the client has to upload photos.</summary>
    public int DurationDays { get; set; }

    /// <summary>Current lifecycle status of the request.</summary>
    public PhotoDiaryStatus Status { get; set; }

    /// <summary>When the request was created.</summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>When the request was last updated (bumped by this link operation).</summary>
    public DateTimeOffset UpdatedAt { get; set; }
}
