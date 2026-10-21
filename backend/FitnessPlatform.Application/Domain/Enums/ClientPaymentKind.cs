namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How a client payment row came to exist.
/// </summary>
public enum ClientPaymentKind
{
    /// <summary>Generated from the client's package, one row per billing period (a one-off package yields one row).</summary>
    Recurring = 1,

    /// <summary>Added by the coach by hand, with its own title, amount and due date and no billing period.</summary>
    OneOff = 2
}
