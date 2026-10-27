namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Where a client payment stands. <see cref="Overdue"/> is derived when a payment is read and is never stored.
/// </summary>
public enum ClientPaymentStatus
{
    /// <summary>Planned, not yet asked of the client; its amount follows the client's current terms.</summary>
    Upcoming = 1,

    /// <summary>The coach asked the client to pay; the amount and payment details are frozen.</summary>
    Requested = 2,

    /// <summary>The coach confirmed the money arrived.</summary>
    Paid = 3,

    /// <summary>The coach waived the payment.</summary>
    Waived = 4,

    /// <summary>Derived: an upcoming or requested payment whose due date has passed. Never stored.</summary>
    Overdue = 5
}
