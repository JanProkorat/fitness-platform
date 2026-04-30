using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CreateRequest;

/// <summary>
/// Response body returned after creating a photo diary request.
/// </summary>
public class CreateRequestResponse
{
    /// <summary>The new request's ID.</summary>
    public Guid Id { get; set; }

    /// <summary>The professional (nutritionist) who created the request.</summary>
    public Guid ProfessionalId { get; set; }

    /// <summary>The client-professional link this request is attached to (if link-based).</summary>
    public long? LinkId { get; set; }

    /// <summary>The pending invite this request is bundled with (if invite-based).</summary>
    public long? PendingInviteId { get; set; }

    /// <summary>Optional plan scope for this request.</summary>
    public Guid? PlanId { get; set; }

    /// <summary>How many days the client has to upload photos.</summary>
    public int DurationDays { get; set; }

    /// <summary>Current lifecycle status (always <c>Pending</c> on creation).</summary>
    public PhotoDiaryStatus Status { get; set; }

    /// <summary>When the request was created.</summary>
    public DateTimeOffset CreatedAt { get; set; }
}
