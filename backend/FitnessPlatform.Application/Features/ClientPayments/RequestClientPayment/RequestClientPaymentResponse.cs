using FitnessPlatform.Application.Features.ClientPayments.Shared;

namespace FitnessPlatform.Application.Features.ClientPayments.RequestClientPayment;

/// <summary>
/// The requested payment and how the request reached the client.
/// </summary>
public class RequestClientPaymentResponse
{
    /// <summary>The payment, now requested, with its amount and bank details frozen.</summary>
    public ClientPaymentRowDto Payment { get; set; } = new();

    /// <summary>Whether the email went out; false when it was not asked for or the mail provider failed.</summary>
    public bool EmailSent { get; set; }

    /// <summary>Whether the app notification was created; false when it was not asked for or failed.</summary>
    public bool NotificationSent { get; set; }
}
