using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Professionals.GetPublicProfile;

public class GetPublicProfileResponse
{
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public List<string> Specializations { get; set; } = [];
    public List<string> Certificates { get; set; } = [];

    /// <summary>The certificates with the issuer and year; the titles repeat <see cref="Certificates"/>.</summary>
    public List<PublicCertificateDto> CertificateDetails { get; set; } = [];

    /// <summary>The packages the coach shows on the profile, cheapest first; empty without payments.</summary>
    public List<PublicProfilePackageDto> Packages { get; set; } = [];

    /// <summary>The coach's email; set only when the caller has a live link to the coach.</summary>
    public string? ContactEmail { get; set; }

    /// <summary>The coach's phone number; set only when the caller has a live link to the coach.</summary>
    public string? ContactPhone { get; set; }
    public List<string> Languages { get; set; } = [];
    public string? City { get; set; }
    public decimal? FromMonthlyPrice { get; set; }
    public PaymentCurrency? FromMonthlyPriceCurrency { get; set; }

    /// <summary>How the cheapest package behind the "from" price is billed; null when there is no price.</summary>
    public PackageBillingInterval? FromPriceBilling { get; set; }

    /// <summary>Weeks between payments of the cheapest package; set only when it is billed every N weeks.</summary>
    public int? FromPriceIntervalWeeks { get; set; }
    public string? CollaborationType { get; set; }
    public string? LinkedIn { get; set; }
    public string? Instagram { get; set; }
    public string? Website { get; set; }
    public List<string> Roles { get; set; } = [];
    public bool HasPendingRequest { get; set; }
    public bool IsLinked { get; set; }
    public bool Online { get; set; }
    public bool AcceptNewClients { get; set; }
    public string? AvatarBlobUrl { get; set; }
}

/// <summary>
/// One certificate on a coach's public profile.
/// </summary>
public class PublicCertificateDto
{
    /// <summary>Title of the certificate.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Who issued it; null when not given.</summary>
    public string? Issuer { get; set; }

    /// <summary>Year it was issued; null when not given.</summary>
    public string? Year { get; set; }
}

/// <summary>
/// One package on a coach's public profile.
/// </summary>
public class PublicProfilePackageDto
{
    /// <summary>Display name of the package.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>How often the package is billed.</summary>
    public PackageBillingInterval Billing { get; set; }

    /// <summary>Weeks between payments; set only for a package billed every N weeks.</summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>Number of payments the package runs for; null means until cancelled.</summary>
    public int? RunsForPayments { get; set; }

    /// <summary>What the package includes; null for none.</summary>
    public string? Description { get; set; }

    /// <summary>The price per payment.</summary>
    public decimal Price { get; set; }

    /// <summary>Currency of the price.</summary>
    public PaymentCurrency Currency { get; set; }
}
