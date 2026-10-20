using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// A client a coach's automations may reach: the coach holds a live link to them that grants
/// access to at least one domain.
/// </summary>
public sealed class AutomationCoveredClient
{
    /// <summary>Internal id of the client profile.</summary>
    public long ClientProfileId { get; init; }

    /// <summary>The client's user id; the key plan documents and check-in rows carry.</summary>
    public Guid ClientUserId { get; init; }

    /// <summary>The client's persisted IANA time zone; null falls back to UTC.</summary>
    public string? TimeZoneId { get; init; }

    /// <summary>When the coach's earliest live link to the client began (UTC).</summary>
    public DateTime LinkedSince { get; init; }

    /// <summary>The earliest live link that grants access; what a delivered request is attached to.</summary>
    public long PrimaryLinkId { get; init; }

    /// <summary>The professional role recorded on <see cref="PrimaryLinkId"/>.</summary>
    public UserRole PrimaryLinkRole { get; init; }

    /// <summary>Whether a live link grants the nutrition domain.</summary>
    public bool CanViewNutritionPlans { get; init; }

    /// <summary>Whether a live link grants the training domain.</summary>
    public bool CanViewTrainingPlans { get; init; }

    /// <summary>Ids of the coach's tags assigned to the client across the coach's live links.</summary>
    public IReadOnlySet<long> TagIds { get; init; } = new HashSet<long>();
}
