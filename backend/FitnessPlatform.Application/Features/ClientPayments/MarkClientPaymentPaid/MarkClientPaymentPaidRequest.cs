namespace FitnessPlatform.Application.Features.ClientPayments.MarkClientPaymentPaid;

/// <summary>
/// Request for confirming that a client's payment arrived.
/// </summary>
public class MarkClientPaymentPaidRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Route parameter — the payment's public id; matches <c>{PaymentId}</c> in the route.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>The day the money arrived; today when omitted. Not in the future.</summary>
    public DateOnly? PaidOn { get; set; }
}
