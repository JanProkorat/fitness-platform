namespace FitnessPlatform.Application.Features.ClientPayments.WaiveClientPayment;

/// <summary>
/// Request for waiving a client's payment.
/// </summary>
public class WaiveClientPaymentRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Route parameter — the payment's public id; matches <c>{PaymentId}</c> in the route.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>Why the payment is waived, up to 100 characters; optional.</summary>
    public string? Reason { get; set; }
}
