using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Discounts.Shared;

/// <summary>
/// The editable fields of a coach discount, shared by the create and update requests so one validator covers both.
/// </summary>
public interface ICoachDiscountInput
{
    /// <summary>Display name.</summary>
    string Name { get; }

    /// <summary>Whether the value is a percentage or a fixed amount.</summary>
    DiscountType Type { get; }

    /// <summary>The percentage (1-100) or the fixed amount.</summary>
    decimal Value { get; }

    /// <summary>How many payments the discount applies to.</summary>
    DiscountDuration Duration { get; }

    /// <summary>Number of payments covered; required for first-N-payments, forbidden otherwise.</summary>
    int? DurationPayments { get; }

    /// <summary>First due date the discount applies to.</summary>
    DateOnly? ValidFrom { get; }

    /// <summary>Last due date the discount applies to.</summary>
    DateOnly? ValidTo { get; }

    /// <summary>Whether the discount applies to every package.</summary>
    bool AppliesToAllPackages { get; }

    /// <summary>Public ids of the packages the discount is limited to.</summary>
    List<Guid> PackageIds { get; }
}
