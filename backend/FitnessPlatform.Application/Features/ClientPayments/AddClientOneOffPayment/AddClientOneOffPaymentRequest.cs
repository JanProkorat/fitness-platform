namespace FitnessPlatform.Application.Features.ClientPayments.AddClientOneOffPayment;

/// <summary>
/// Request for adding a one-off payment to a client.
/// </summary>
public class AddClientOneOffPaymentRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }

    /// <summary>What the payment is for, up to 100 characters.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>The amount in CZK, above zero and at most 9999999.99.</summary>
    public decimal Amount { get; set; }

    /// <summary>The day the payment falls due.</summary>
    public DateOnly DueDate { get; set; }
}
