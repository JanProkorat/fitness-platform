namespace FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentSummary;

/// <summary>
/// Request for the payment summary of one of the coach's clients.
/// </summary>
public class GetClientPaymentSummaryRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }
}
