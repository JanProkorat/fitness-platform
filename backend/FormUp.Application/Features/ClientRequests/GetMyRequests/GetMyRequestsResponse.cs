using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.ClientRequests.GetMyRequests;

/// <summary>
/// Response model containing the client's sent requests.
/// </summary>
public class GetMyRequestsResponse
{
    public List<ClientRequestDto> Requests { get; set; } = [];
}

public class ClientRequestDto
{
    public Guid PublicId { get; set; }
    public Guid ProfessionalPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? Message { get; set; }
    public ClientRequestStatus Status { get; set; }
    public DateTime SentAt { get; set; }
    public DateTime? RespondedAt { get; set; }

    /// <summary>The coach's package proposal waiting for the client's answer; null unless Status is PackageProposed.</summary>
    public ClientRequestProposalDto? Proposal { get; set; }
}

/// <summary>
/// A package the coach proposed on the client's request.
/// </summary>
public class ClientRequestProposalDto
{
    /// <summary>When the proposal was sent (UTC).</summary>
    public DateTime ProposedAt { get; set; }

    /// <summary>The coach's message with the proposal.</summary>
    public string? Statement { get; set; }

    /// <summary>Title of the form the client fills in after accepting; null when none.</summary>
    public string? QuestionnaireTitle { get; set; }

    /// <summary>The proposed package.</summary>
    public ClientRequestProposalPackageDto Package { get; set; } = new();

    /// <summary>The proposed discount; null when none.</summary>
    public ClientRequestProposalDiscountDto? Discount { get; set; }
}

/// <summary>
/// The package of a proposal.
/// </summary>
public class ClientRequestProposalPackageDto
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
/// The discount of a proposal.
/// </summary>
public class ClientRequestProposalDiscountDto
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
