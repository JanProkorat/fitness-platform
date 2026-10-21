namespace FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentHistory;

/// <summary>
/// Request for the payment change history of one of the coach's clients.
/// </summary>
public class GetClientPaymentHistoryRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }
}
