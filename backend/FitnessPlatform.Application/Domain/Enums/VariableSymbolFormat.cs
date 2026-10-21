namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How the variable symbol of a payment request is derived.
/// </summary>
public enum VariableSymbolFormat
{
    /// <summary>Year, month and the client's number, unique per payment.</summary>
    YearMonthClientNumber = 1,

    /// <summary>Year, month and a running sequence number of the coach's payment requests.</summary>
    YearMonthSequence = 2
}
