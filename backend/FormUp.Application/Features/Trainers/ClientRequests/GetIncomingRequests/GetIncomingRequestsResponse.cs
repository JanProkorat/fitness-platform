using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.Trainers.ClientRequests.GetIncomingRequests;

/// <summary>
/// Response model containing incoming client requests for a professional.
/// </summary>
public class GetIncomingRequestsResponse
{
    public List<IncomingClientRequestDto> Requests { get; set; } = [];
}

public class IncomingClientRequestDto
{
    public Guid PublicId { get; set; }
    public string ClientFirstName { get; set; } = string.Empty;
    public string ClientLastName { get; set; } = string.Empty;
    public string ClientEmail { get; set; } = string.Empty;
    public string? Message { get; set; }
    public DateTime SentAt { get; set; }

    /// <summary>Public id of the requesting client's profile.</summary>
    public Guid ClientPublicId { get; set; }

    /// <summary>Client height in cm, as on the coach client dashboard.</summary>
    public decimal? HeightCm { get; set; }

    /// <summary>Client weight in kg, as on the coach client dashboard.</summary>
    public decimal? WeightKg { get; set; }

    /// <summary>Onboarding primary goal (enum name), null when onboarding is not done.</summary>
    public string? PrimaryGoal { get; set; }

    /// <summary>Activity level derived at onboarding (enum name), null when not available.</summary>
    public string? DerivedActivityLevel { get; set; }

    /// <summary>The package the client attached to the request; null when none, or when it was deleted.</summary>
    public IncomingRequestPackageDto? Package { get; set; }

    /// <summary>Whether the client agreed to share their history with the coach.</summary>
    public bool ShareHistory { get; set; }

    /// <summary>Counts of the client's history; null unless <see cref="ShareHistory"/> is true.</summary>
    public IncomingRequestHistoryDto? History { get; set; }

    /// <summary><see cref="ClientRequestStatus.Pending"/>, or <see cref="ClientRequestStatus.PackageProposed"/> while a proposal waits for the client.</summary>
    public ClientRequestStatus Status { get; set; }

    /// <summary>The coach's open package proposal; null unless <see cref="Status"/> is PackageProposed.</summary>
    public IncomingRequestProposalDto? Proposal { get; set; }
}

/// <summary>
/// A package the coach proposed on an incoming request.
/// </summary>
public class IncomingRequestProposalDto
{
    /// <summary>When the proposal was sent (UTC).</summary>
    public DateTime ProposedAt { get; set; }

    /// <summary>The proposed package.</summary>
    public IncomingRequestPackageDto Package { get; set; } = new();

    /// <summary>The proposed discount; null when none.</summary>
    public IncomingRequestDiscountDto? Discount { get; set; }
}

/// <summary>
/// The discount of a package proposal.
/// </summary>
public class IncomingRequestDiscountDto
{
    /// <summary>Public id of the discount.</summary>
    public Guid PublicId { get; set; }

    /// <summary>Display name of the discount.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether <see cref="Value"/> is a percentage or a fixed amount.</summary>
    public DiscountType Type { get; set; }

    /// <summary>The percentage or the fixed amount taken off the price.</summary>
    public decimal Value { get; set; }

    /// <summary>Currency of a fixed amount; null for a percentage.</summary>
    public PaymentCurrency? Currency { get; set; }
}

/// <summary>
/// The package attached to an incoming request.
/// </summary>
public class IncomingRequestPackageDto
{
    /// <summary>Public id of the package.</summary>
    public Guid PublicId { get; set; }

    /// <summary>Display name of the package.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>How often the package is billed.</summary>
    public PackageBillingInterval Billing { get; set; }

    /// <summary>Weeks between payments; set only for a package billed every N weeks.</summary>
    public int? IntervalWeeks { get; set; }

    /// <summary>The price per payment.</summary>
    public decimal Price { get; set; }

    /// <summary>Currency of the price.</summary>
    public PaymentCurrency Currency { get; set; }
}

/// <summary>
/// Summary of the history a client shares with the coach.
/// </summary>
public class IncomingRequestHistoryDto
{
    /// <summary>Nutrition and training plans from any coach.</summary>
    public int PlanCount { get; set; }

    /// <summary>Body measurements.</summary>
    public int MeasurementCount { get; set; }

    /// <summary>Progress photos.</summary>
    public int PhotoCount { get; set; }
}
