using FitnessPlatform.Application.Domain.Enums;

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

    /// <summary>The amount in <see cref="Currency"/>, above zero and at most 9999999.99.</summary>
    public decimal Amount { get; set; }

    /// <summary>The currency of the amount; the coach's main currency when omitted.</summary>
    public PaymentCurrency? Currency { get; set; }

    /// <summary>The day the payment falls due.</summary>
    public DateOnly DueDate { get; set; }
}
