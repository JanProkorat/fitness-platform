using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Client.Collaborations.GetAll;

/// <summary>
/// The first payment of a collaboration's current terms. Carries no bank details; the client matches
/// <see cref="PaymentId"/> against <c>GET /client/payments</c> for the QR data.
/// </summary>
public class CollaborationFirstPaymentDto
{
    /// <summary>Name of the package the payment is for.</summary>
    public string? PackageName { get; set; }

    /// <summary>Amount of the payment, or null when it cannot be worked out.</summary>
    public decimal? Amount { get; set; }

    /// <summary>Currency of the amount.</summary>
    public PaymentCurrency Currency { get; set; }

    /// <summary>Upcoming, Requested, Overdue, Paid or Waived.</summary>
    public ClientPaymentStatus Status { get; set; }

    /// <summary>The day the payment falls due.</summary>
    public DateOnly DueDate { get; set; }

    /// <summary>Public id of the payment once the coach has requested it; null while it is only upcoming.</summary>
    public Guid? PaymentId { get; set; }
}
