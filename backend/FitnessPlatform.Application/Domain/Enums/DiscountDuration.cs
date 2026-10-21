namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How many payments of a client a coach discount applies to.
/// </summary>
public enum DiscountDuration
{
    /// <summary>Every payment inside the validity window.</summary>
    EveryPayment = 1,

    /// <summary>Only the first N payments of the client.</summary>
    FirstPayments = 2
}
