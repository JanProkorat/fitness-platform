using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.Client.GetClientPayments;

/// <summary>
/// What the client owes and has paid, grouped by coach.
/// </summary>
public class GetClientPaymentsResponse
{
    /// <summary>One entry per coach the client has linked payments with; empty when there are none.</summary>
    public List<ClientPaymentCoachDto> Coaches { get; set; } = [];
}

/// <summary>
/// One coach's payments as the client sees them.
/// </summary>
public class ClientPaymentCoachDto
{
    /// <summary>Public id of the coach's professional profile.</summary>
    public Guid CoachId { get; set; }

    /// <summary>The coach's name.</summary>
    public string CoachName { get; set; } = string.Empty;

    /// <summary>Payments the coach asked for, still unpaid (overdue ones marked), oldest due date first.</summary>
    public List<ClientPaymentItemDto> Requested { get; set; } = [];

    /// <summary>Payments already paid, most recent first.</summary>
    public List<ClientPaymentItemDto> Paid { get; set; } = [];
}

/// <summary>
/// One requested or paid payment with everything the client needs to pay it.
/// </summary>
public class ClientPaymentItemDto
{
    /// <summary>Public id of the payment.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>Requested, Overdue (requested and past its due date) or Paid.</summary>
    public ClientPaymentStatus Status { get; set; }

    /// <summary>Package name, or the title of a one-off payment.</summary>
    public string? Name { get; set; }

    /// <summary>First day of the billing period; null for a one-off payment.</summary>
    public DateOnly? PeriodStart { get; set; }

    /// <summary>Last day of the billing period; null for a one-off payment.</summary>
    public DateOnly? PeriodEnd { get; set; }

    /// <summary>Amount in <see cref="Currency"/>.</summary>
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

    /// <summary>Day the coach confirmed the money; paid payments only.</summary>
    public DateOnly? PaidOn { get; set; }

    /// <summary>The coach's IBAN; requested payments only.</summary>
    public string? Iban { get; set; }

    /// <summary>Name of the account holder; requested payments only.</summary>
    public string? AccountHolder { get; set; }

    /// <summary>Variable symbol to put on the transfer; requested payments only.</summary>
    public string? VariableSymbol { get; set; }

    /// <summary>Transfer message; requested payments only.</summary>
    public string? Message { get; set; }

    /// <summary>The QR Platba (SPAYD) payload to render as a QR code; requested payments only.</summary>
    public string? QrPayload { get; set; }

    /// <summary>
    /// Maps a requested or paid payment. Payment details are included only while it is unpaid.
    /// </summary>
    /// <param name="payment">The payment.</param>
    /// <param name="today">Today in the schedule's zone, for the derived status.</param>
    public static ClientPaymentItemDto FromEntity(ClientPayment payment, DateOnly today)
    {
        var item = new ClientPaymentItemDto
        {
            PaymentId = payment.PublicId,
            Status = ClientPaymentSchedule.DerivedStatus(payment.Status, payment.DueDate, today),
            Name = payment.PackageName ?? payment.Title,
            PeriodStart = payment.PeriodStart,
            PeriodEnd = payment.PeriodEnd,
            Amount = payment.Amount,
            Currency = payment.Currency,
            BasePrice = payment.BasePrice,
            DiscountLabel = payment.DiscountLabel,
            IsCustomPrice = payment.IsCustomPrice,
            DueDate = payment.DueDate,
            PaidOn = payment.PaidOn
        };

        if (payment.Status != ClientPaymentStatus.Requested)
        {
            return item;
        }

        item.Iban = payment.AccountIban;
        item.AccountHolder = payment.AccountHolder;
        item.VariableSymbol = payment.VariableSymbol;
        item.Message = payment.Message;

        if (payment.AccountIban is not null && payment.Amount is > 0 and <= ClientPaymentSchedule.MaxAmount)
        {
            item.QrPayload = SpaydBuilder.Build(
                payment.AccountIban,
                payment.Amount.Value,
                payment.VariableSymbol,
                payment.Message,
                payment.DueDate,
                payment.AccountHolder,
                payment.Currency);
        }

        return item;
    }
}
