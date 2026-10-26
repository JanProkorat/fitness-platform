using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// One payment a client owes a coach. While it is <see cref="ClientPaymentStatus.Upcoming"/> a recurring
/// payment keeps no amount (it follows the client's terms); once it leaves that status the amount, the
/// package name, the price breakdown and the bank details are frozen on the row.
/// </summary>
public class ClientPayment : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ClientPaymentAssignment"/>.
    /// </summary>
    public long ClientPaymentAssignmentId { get; set; }

    /// <summary>
    /// The coach's <see cref="ProfessionalProfile"/> id, copied from the assignment so the variable symbol
    /// can be unique per coach.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Whether the row was generated from the client's package or added by hand.
    /// </summary>
    public ClientPaymentKind Kind { get; set; } = ClientPaymentKind.Recurring;

    /// <summary>
    /// Stored status; <see cref="ClientPaymentStatus.Overdue"/> is never stored.
    /// </summary>
    public ClientPaymentStatus Status { get; set; } = ClientPaymentStatus.Upcoming;

    /// <summary>
    /// First day of the billing period; null for a one-off payment added by hand.
    /// </summary>
    public DateOnly? PeriodStart { get; set; }

    /// <summary>
    /// Last day of the billing period; null for a one-off payment added by hand.
    /// </summary>
    public DateOnly? PeriodEnd { get; set; }

    /// <summary>
    /// The day the payment falls due.
    /// </summary>
    public DateOnly DueDate { get; set; }

    /// <summary>
    /// The amount in <see cref="Currency"/>; null while a recurring payment is still upcoming.
    /// </summary>
    public decimal? Amount { get; set; }

    /// <summary>
    /// The currency of the payment, taken from the package when the row is created or chosen for a one-off payment.
    /// </summary>
    public PaymentCurrency Currency { get; set; } = PaymentCurrency.CZK;

    /// <summary>
    /// Variable symbol the client puts on the transfer; unique per coach, null once the payment is waived.
    /// </summary>
    [MaxLength(10)]
    public string? VariableSymbol { get; set; }

    /// <summary>
    /// Title of a one-off payment added by hand.
    /// </summary>
    [MaxLength(100)]
    public string? Title { get; set; }

    /// <summary>
    /// The transfer message, frozen when the payment is requested.
    /// </summary>
    [MaxLength(60)]
    public string? Message { get; set; }

    /// <summary>
    /// When the client was last asked to pay (UTC).
    /// </summary>
    public DateTime? RequestedAt { get; set; }

    /// <summary>
    /// The day the money arrived, as confirmed by the coach.
    /// </summary>
    public DateOnly? PaidOn { get; set; }

    /// <summary>
    /// Why the coach waived the payment.
    /// </summary>
    [MaxLength(100)]
    public string? WaiveReason { get; set; }

    /// <summary>
    /// Name of the package, frozen with the amount.
    /// </summary>
    [MaxLength(100)]
    public string? PackageName { get; set; }

    /// <summary>
    /// The package price before any discount, frozen with the amount.
    /// </summary>
    public decimal? BasePrice { get; set; }

    /// <summary>
    /// Label of the discount behind the amount, frozen with it. Null for a custom price.
    /// </summary>
    [MaxLength(150)]
    public string? DiscountLabel { get; set; }

    /// <summary>
    /// Whether the frozen amount is a custom price the coach set, frozen with the amount.
    /// </summary>
    public bool IsCustomPrice { get; set; }

    /// <summary>
    /// Whether the row was kept for the coach when the collaboration ended: a period starting after the end.
    /// Kept rows belong to the ended terms and take no part in the schedule or ordinals of later terms.
    /// </summary>
    public bool IsKeptAfterEnd { get; set; }

    /// <summary>
    /// The coach's IBAN at the time of the request.
    /// </summary>
    [MaxLength(34)]
    public string? AccountIban { get; set; }

    /// <summary>
    /// The account holder at the time of the request.
    /// </summary>
    [MaxLength(140)]
    public string? AccountHolder { get; set; }

    /// <summary>
    /// Navigation property to the assignment.
    /// </summary>
    public ClientPaymentAssignment ClientPaymentAssignment { get; set; } = null!;
}
