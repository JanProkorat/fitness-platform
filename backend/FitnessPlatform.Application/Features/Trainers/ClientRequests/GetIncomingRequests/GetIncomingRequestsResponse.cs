using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.GetIncomingRequests;

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
