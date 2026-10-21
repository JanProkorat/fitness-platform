namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How the payment message (the free-text note on a bank transfer) is composed.
/// </summary>
public enum PaymentMessageFormat
{
    /// <summary>Package name followed by the billing month, e.g. "Online coaching 11/2026".</summary>
    PackageNameAndMonth = 1,

    /// <summary>Package name only.</summary>
    PackageName = 2,

    /// <summary>Client's name followed by the billing month.</summary>
    ClientNameAndMonth = 3
}
