using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Everything the payment request email shows, already resolved: the sender renders it in the
/// recipient's language and attaches the QR code inline under <see cref="QrContentId"/>.
/// </summary>
/// <param name="ToEmail">The client's email address.</param>
/// <param name="Language">Two-letter language code (en, cs, de).</param>
/// <param name="CoachName">The coach's name.</param>
/// <param name="PackageName">Package name, or the title of a one-off payment.</param>
/// <param name="PeriodStart">First day of the billing period; null for a one-off payment.</param>
/// <param name="PeriodEnd">Last day of the billing period; null for a one-off payment.</param>
/// <param name="Amount">The amount in <paramref name="Currency"/>.</param>
/// <param name="BasePrice">The package price before any discount, or null.</param>
/// <param name="DiscountLabel">Label of the discount or custom price, or null.</param>
/// <param name="DueDate">The day the payment falls due.</param>
/// <param name="Iban">The coach's IBAN.</param>
/// <param name="VariableSymbol">The variable symbol to put on the transfer.</param>
/// <param name="Message">The transfer message.</param>
/// <param name="QrPng">The QR Platba code as a PNG image.</param>
/// <param name="QrContentId">Content id the HTML refers to as <c>cid:</c>.</param>
/// <param name="Currency">The currency of the amounts.</param>
public sealed record PaymentRequestEmail(
    string ToEmail,
    string Language,
    string CoachName,
    string PackageName,
    DateOnly? PeriodStart,
    DateOnly? PeriodEnd,
    decimal Amount,
    decimal? BasePrice,
    string? DiscountLabel,
    DateOnly DueDate,
    string Iban,
    string VariableSymbol,
    string Message,
    byte[] QrPng,
    string QrContentId,
    PaymentCurrency Currency = PaymentCurrency.CZK);
