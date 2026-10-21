namespace FitnessPlatform.Application.Features.ClientPayments.ListClientPaymentRows;

/// <summary>
/// Request for the payments of one of the coach's clients.
/// </summary>
public class ListClientPaymentRowsRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }
}
