using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.CoachPackages.Shared;

/// <summary>
/// A coach package as shown to its owner — reused by the list, get, create and update actions.
/// </summary>
public class CoachPackageDto
{
    /// <summary>Public id of the package.</summary>
    public Guid PackageId { get; set; }

    /// <summary>Display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>What the package includes, or null for none.</summary>
    public string? Description { get; set; }

    /// <summary>Current price per billing period.</summary>
    public decimal Price { get; set; }

    /// <summary>The currency of the price.</summary>
    public PaymentCurrency Currency { get; set; }

    /// <summary>How often the package is billed.</summary>
    public PackageBillingInterval Billing { get; set; }

    /// <summary>Weeks between payments when billed every N weeks, otherwise null.</summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>Number of payments the package runs for, or null until cancelled.</summary>
    public int? RunsForPayments { get; set; }

    /// <summary>Payment due days overriding the coach's default, or null to use it.</summary>
    public int? PaymentDueDaysOverride { get; set; }

    /// <summary>Whether the price is shown on the coach's public profile.</summary>
    public bool ShowOnProfile { get; set; }

    /// <summary>How many clients currently have this package assigned.</summary>
    public int ClientCount { get; set; }

    /// <summary>When the package was archived (UTC), or null while active.</summary>
    public DateTime? ArchivedAt { get; set; }

    /// <summary>
    /// Maps a package row to its wire form.
    /// </summary>
    /// <param name="package">The stored package.</param>
    /// <param name="clientCount">How many clients currently have the package assigned.</param>
    public static CoachPackageDto FromEntity(CoachPackage package, int clientCount = 0) => new()
    {
        PackageId = package.PublicId,
        Name = package.Name,
        Description = package.Description,
        Price = package.Price,
        Currency = package.Currency,
        ClientCount = clientCount,
        Billing = package.Billing,
        IntervalWeeks = package.IntervalWeeks,
        RunsForPayments = package.RunsForPayments,
        PaymentDueDaysOverride = package.PaymentDueDaysOverride,
        ShowOnProfile = package.ShowOnProfile,
        ArchivedAt = package.ArchivedAt
    };
}
