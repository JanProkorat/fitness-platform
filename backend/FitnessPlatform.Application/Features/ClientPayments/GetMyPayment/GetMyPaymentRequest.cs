namespace FitnessPlatform.Application.Features.ClientPayments.GetMyPayment;

/// <summary>
/// Request for one of the calling client's own payments.
/// </summary>
public class GetMyPaymentRequest
{
    /// <summary>Route parameter — the payment's public id; matches <c>{PaymentId}</c> in the route.</summary>
    public Guid PaymentId { get; set; }
}
