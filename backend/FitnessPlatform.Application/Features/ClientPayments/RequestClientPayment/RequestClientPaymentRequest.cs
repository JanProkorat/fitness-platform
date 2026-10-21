namespace FitnessPlatform.Application.Features.ClientPayments.RequestClientPayment;

/// <summary>
/// Request for asking a client to pay.
/// </summary>
public class RequestClientPaymentRequest
{
    /// <summary>Route parameter — the client's profile public id; matches <c>{ClientId}</c> in the route.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Route parameter — the payment's public id; matches <c>{PaymentId}</c> in the route.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>Due date override; when omitted, never earlier than the period start and the coach's payment term from today.</summary>
    public DateOnly? DueDate { get; set; }

    /// <summary>Amount override in CZK; when omitted, the amount the client's terms give.</summary>
    public decimal? Amount { get; set; }

    /// <summary>Send the request by email with the QR code.</summary>
    public bool SendEmail { get; set; }

    /// <summary>Send the request as an app notification.</summary>
    public bool SendNotification { get; set; }
}
