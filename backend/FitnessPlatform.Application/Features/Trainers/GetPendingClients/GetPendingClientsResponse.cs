using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.GetPendingClients;

/// <summary>
/// Response model for the trainer's Pending tab.
/// </summary>
public class GetPendingClientsResponse
{
    /// <summary>
    /// Merged, unpaginated rows — unaccepted invites plus incoming pending requests, ordered by
    /// <see cref="PendingClientRow.SentAt"/> descending.
    /// </summary>
    public List<PendingClientRow> Rows { get; set; } = [];
}

/// <summary>
/// A single Pending-tab row. <see cref="Kind"/> tells the client which existing action endpoint
/// to call with <see cref="PublicId"/> — cancel an invite, or accept/reject a request.
/// </summary>
public class PendingClientRow
{
    /// <summary>Which source table this row came from.</summary>
    public PendingRowKind Kind { get; set; }

    /// <summary>
    /// Public identifier of the source row — <c>PendingInvite.PublicId</c> for
    /// <see cref="PendingRowKind.Invite"/>, <c>ClientRequest.PublicId</c> for
    /// <see cref="PendingRowKind.Request"/>. This is the id the row's action endpoint expects.
    /// </summary>
    public Guid PublicId { get; set; }

    /// <summary>First name of the prospective client.</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Last name of the prospective client.</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>Email address of the prospective client.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>Optional message attached to the invite or request.</summary>
    public string? Message { get; set; }

    /// <summary>When the invite was sent, or the request was submitted.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>
    /// <see cref="PendingInviteStatus.Pending"/>, or <see cref="PendingInviteStatus.Expired"/> for an
    /// invite past its validity window that has not been re-sent. Always Pending for requests.
    /// </summary>
    public PendingInviteStatus Status { get; set; } = PendingInviteStatus.Pending;

    /// <summary>The package attached to the request, or stored on the invite; null when none.</summary>
    public PendingRowPackageDto? Package { get; set; }

    /// <summary>Whether the client agreed to share their history; always false for invite rows.</summary>
    public bool ShareHistory { get; set; }

    /// <summary>History counts; null unless this is a request row with <see cref="ShareHistory"/> true.</summary>
    public PendingRowHistoryDto? History { get; set; }

    /// <summary>
    /// The coach's package proposal waiting for the client's answer; null for invites and for requests without one.
    /// </summary>
    public PendingRowProposalDto? Proposal { get; set; }
}

/// <summary>
/// A package the coach proposed on a request row.
/// </summary>
public class PendingRowProposalDto
{
    /// <summary>When the proposal was sent (UTC).</summary>
    public DateTime ProposedAt { get; set; }

    /// <summary>The proposed package.</summary>
    public PendingRowPackageDto Package { get; set; } = new();

    /// <summary>The proposed discount; null when none.</summary>
    public PendingRowDiscountDto? Discount { get; set; }
}

/// <summary>
/// The discount of a package proposal.
/// </summary>
public class PendingRowDiscountDto
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
/// The package attached to a pending request row.
/// </summary>
public class PendingRowPackageDto
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
public class PendingRowHistoryDto
{
    /// <summary>Nutrition and training plans from any coach.</summary>
    public int PlanCount { get; set; }

    /// <summary>Body measurements.</summary>
    public int MeasurementCount { get; set; }

    /// <summary>Progress photos.</summary>
    public int PhotoCount { get; set; }
}
