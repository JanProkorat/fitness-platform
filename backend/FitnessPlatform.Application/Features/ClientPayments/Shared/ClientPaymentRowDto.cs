using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.ClientPayments.Shared;

/// <summary>
/// One payment of a client as the coach sees it.
/// </summary>
public class ClientPaymentRowDto
{
    /// <summary>Public id of the payment.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>Whether the row was generated from the package or added by hand.</summary>
    public ClientPaymentKind Kind { get; set; }

    /// <summary>Status; Overdue is derived from the due date and never stored.</summary>
    public ClientPaymentStatus Status { get; set; }

    /// <summary>First day of the billing period; null for a one-off payment.</summary>
    public DateOnly? PeriodStart { get; set; }

    /// <summary>Last day of the billing period; null for a one-off payment.</summary>
    public DateOnly? PeriodEnd { get; set; }

    /// <summary>Title of a one-off payment.</summary>
    public string? Title { get; set; }

    /// <summary>Package name; for an upcoming payment the package the client's terms give now.</summary>
    public string? PackageName { get; set; }

    /// <summary>Amount in <see cref="Currency"/>; for an upcoming payment what the client's terms give now.</summary>
    public decimal? Amount { get; set; }

    /// <summary>The currency of the amounts.</summary>
    public PaymentCurrency Currency { get; set; }

    /// <summary>Package price before any discount.</summary>
    public decimal? BasePrice { get; set; }

    /// <summary>Label of the discount behind the amount; null for a custom price (see <see cref="IsCustomPrice"/>).</summary>
    public string? DiscountLabel { get; set; }

    /// <summary>Whether the amount is a custom price the coach set; clients localize the wording.</summary>
    public bool IsCustomPrice { get; set; }

    /// <summary>Day the payment falls due.</summary>
    public DateOnly DueDate { get; set; }

    /// <summary>Variable symbol of the transfer; null once the payment is waived.</summary>
    public string? VariableSymbol { get; set; }

    /// <summary>Transfer message the client sees.</summary>
    public string? Message { get; set; }

    /// <summary>When the client was last asked to pay (UTC).</summary>
    public DateTime? RequestedAt { get; set; }

    /// <summary>Day the money arrived.</summary>
    public DateOnly? PaidOn { get; set; }

    /// <summary>Why the payment was waived.</summary>
    public string? WaiveReason { get; set; }

    /// <summary>
    /// Maps a payment, with the figures and message already resolved, to its row.
    /// </summary>
    /// <param name="payment">The payment.</param>
    /// <param name="status">The derived status.</param>
    /// <param name="figures">Amount, price breakdown and package name to show.</param>
    /// <param name="message">The transfer message to show.</param>
    public static ClientPaymentRowDto FromEntity(
        ClientPayment payment,
        ClientPaymentStatus status,
        (decimal? Amount, decimal? BasePrice, string? DiscountLabel, string? PackageName, bool IsCustomPrice) figures,
        string? message) => new()
    {
        PaymentId = payment.PublicId,
        Kind = payment.Kind,
        Status = status,
        PeriodStart = payment.PeriodStart,
        PeriodEnd = payment.PeriodEnd,
        Title = payment.Title,
        PackageName = figures.PackageName,
        Amount = figures.Amount,
        Currency = payment.Currency,
        BasePrice = figures.BasePrice,
        DiscountLabel = figures.DiscountLabel,
        IsCustomPrice = figures.IsCustomPrice,
        DueDate = payment.DueDate,
        VariableSymbol = payment.VariableSymbol,
        Message = message,
        RequestedAt = payment.RequestedAt,
        PaidOn = payment.PaidOn,
        WaiveReason = payment.WaiveReason
    };

    /// <summary>
    /// Maps a payment whose figures are already frozen on the row.
    /// </summary>
    /// <param name="payment">The payment.</param>
    /// <param name="today">Today in the schedule's zone, for the derived status.</param>
    public static ClientPaymentRowDto FromFrozenEntity(ClientPayment payment, DateOnly today) =>
        FromEntity(
            payment,
            ClientPaymentSchedule.DerivedStatus(payment.Status, payment.DueDate, today),
            (
                payment.Amount,
                payment.BasePrice,
                ClientPaymentSchedule.PublicDiscountLabel(payment.DiscountLabel),
                payment.PackageName ?? payment.Title,
                ClientPaymentSchedule.IsCustomPriceLabel(payment.DiscountLabel)),
            payment.Message);
}
