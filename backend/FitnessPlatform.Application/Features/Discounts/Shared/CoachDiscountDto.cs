using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Discounts.Shared;

/// <summary>
/// A coach discount as shown to its owner — reused by the list, get, create and update actions.
/// </summary>
public class CoachDiscountDto
{
    /// <summary>Public id of the discount.</summary>
    public Guid DiscountId { get; set; }

    /// <summary>Display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether the value is a percentage or a fixed amount.</summary>
    public DiscountType Type { get; set; }

    /// <summary>The percentage or the fixed amount.</summary>
    public decimal Value { get; set; }

    /// <summary>How many payments the discount applies to.</summary>
    public DiscountDuration Duration { get; set; }

    /// <summary>Number of payments covered when the duration is first-N-payments, otherwise null.</summary>
    public int? DurationPayments { get; set; }

    /// <summary>First due date the discount applies to (inclusive), or null for no start limit.</summary>
    public DateOnly? ValidFrom { get; set; }

    /// <summary>Last due date the discount applies to (inclusive), or null for open-ended.</summary>
    public DateOnly? ValidTo { get; set; }

    /// <summary>The currency of a fixed amount; null for a percentage discount.</summary>
    public PaymentCurrency? Currency { get; set; }

    /// <summary>Which packages the discount can be used with.</summary>
    public DiscountScope Scope { get; set; }

    /// <summary>Public ids of the packages the discount is limited to; empty unless the scope is selected packages.</summary>
    public List<Guid> PackageIds { get; set; } = [];

    /// <summary>How many clients' current terms use the discount.</summary>
    public int UsedByCount { get; set; }

    /// <summary>When the discount was archived (UTC), or null while active.</summary>
    public DateTime? ArchivedAt { get; set; }

    /// <summary>
    /// Maps a discount row, with its package links and their packages loaded, to its wire form.
    /// </summary>
    /// <param name="discount">The stored discount.</param>
    /// <param name="usedByCount">How many clients' current terms use the discount.</param>
    public static CoachDiscountDto FromEntity(CoachDiscount discount, int usedByCount = 0) => new()
    {
        DiscountId = discount.PublicId,
        Name = discount.Name,
        Type = discount.Type,
        Value = discount.Value,
        Duration = discount.Duration,
        DurationPayments = discount.DurationPayments,
        ValidFrom = discount.ValidFrom,
        ValidTo = discount.ValidTo,
        Currency = discount.Currency,
        Scope = discount.Scope,
        PackageIds = discount.Packages.Select(l => l.CoachPackage.PublicId).ToList(),
        UsedByCount = usedByCount,
        ArchivedAt = discount.ArchivedAt
    };
}
