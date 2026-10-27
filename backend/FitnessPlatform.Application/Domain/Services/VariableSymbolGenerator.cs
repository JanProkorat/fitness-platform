using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Picks a coach's next variable symbol: ten digits, the year and month followed by four digits,
/// never equal to a symbol the coach has already used.
/// </summary>
public static class VariableSymbolGenerator
{
    /// <summary>Largest four-digit tail.</summary>
    public const int MaxTail = 9999;

    /// <summary>
    /// Picks a variable symbol for a payment. With <see cref="VariableSymbolFormat.YearMonthClientNumber"/>
    /// it is the month followed by the client's number; when that is taken (a second payment of the same
    /// client in the month, or a symbol made under another format) it is the highest free tail instead, so
    /// the low tails stay free for the clients whose numbers they are. With
    /// <see cref="VariableSymbolFormat.YearMonthSequence"/> it is the lowest free tail.
    /// </summary>
    /// <param name="format">How symbols are derived.</param>
    /// <param name="referenceDate">Any day of the payment's month.</param>
    /// <param name="clientNumber">The client's number in the coach's books.</param>
    /// <param name="usedSymbols">Every symbol the coach already holds.</param>
    /// <returns>The symbol, or null when every tail of the month is taken.</returns>
    public static string? Generate(
        VariableSymbolFormat format,
        DateOnly referenceDate,
        int clientNumber,
        IReadOnlySet<string> usedSymbols)
    {
        var prefix = $"{referenceDate.Year:D4}{referenceDate.Month:D2}";

        if (format == VariableSymbolFormat.YearMonthSequence)
        {
            return Enumerable.Range(1, MaxTail)
                .Select(tail => prefix + tail.ToString("D4"))
                .FirstOrDefault(symbol => !usedSymbols.Contains(symbol));
        }

        var preferred = prefix + clientNumber.ToString("D4");

        if (!usedSymbols.Contains(preferred))
        {
            return preferred;
        }

        return Enumerable.Range(1, MaxTail)
            .Reverse()
            .Select(tail => prefix + tail.ToString("D4"))
            .FirstOrDefault(symbol => !usedSymbols.Contains(symbol));
    }
}
