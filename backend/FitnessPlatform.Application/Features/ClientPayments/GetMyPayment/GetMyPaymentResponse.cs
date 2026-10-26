using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.ClientPayments.GetMyPayment;

/// <summary>
/// One of the client's payments with everything needed to pay it.
/// </summary>
public class GetMyPaymentResponse
{
    /// <summary>Public id of the payment.</summary>
    public Guid PaymentId { get; set; }

    /// <summary>The coach's name.</summary>
    public string CoachName { get; set; } = string.Empty;

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

    /// <summary>The coach's IBAN; unpaid payments only.</summary>
    public string? Iban { get; set; }

    /// <summary>Name of the account holder; unpaid payments only.</summary>
    public string? AccountHolder { get; set; }

    /// <summary>Variable symbol to put on the transfer; unpaid payments only.</summary>
    public string? VariableSymbol { get; set; }

    /// <summary>Transfer message; unpaid payments only.</summary>
    public string? Message { get; set; }

    /// <summary>The QR Platba (SPAYD) payload to render as a QR code; unpaid payments only.</summary>
    public string? QrPayload { get; set; }

    /// <summary>
    /// Maps a requested or paid payment. Payment details are included only while it is unpaid.
    /// </summary>
    /// <param name="payment">The payment.</param>
    /// <param name="coachName">The coach's name.</param>
    /// <param name="today">Today in the schedule's zone, for the derived status.</param>
    public static GetMyPaymentResponse FromEntity(ClientPayment payment, string coachName, DateOnly today)
    {
        var response = new GetMyPaymentResponse
        {
            PaymentId = payment.PublicId,
            CoachName = coachName,
            Status = ClientPaymentSchedule.DerivedStatus(payment.Status, payment.DueDate, today),
            Name = payment.PackageName ?? payment.Title,
            PeriodStart = payment.PeriodStart,
            PeriodEnd = payment.PeriodEnd,
            Amount = payment.Amount,
            Currency = payment.Currency,
            BasePrice = payment.BasePrice,
            DiscountLabel = ClientPaymentSchedule.PublicDiscountLabel(payment.DiscountLabel),
            IsCustomPrice = ClientPaymentSchedule.IsCustomPriceLabel(payment.DiscountLabel),
            DueDate = payment.DueDate,
            PaidOn = payment.PaidOn
        };

        if (payment.Status != ClientPaymentStatus.Requested)
        {
            return response;
        }

        response.Iban = payment.AccountIban;
        response.AccountHolder = payment.AccountHolder;
        response.VariableSymbol = payment.VariableSymbol;
        response.Message = payment.Message;

        if (payment.AccountIban is not null && payment.Amount is > 0 and <= ClientPaymentSchedule.MaxAmount)
        {
            response.QrPayload = SpaydBuilder.Build(
                payment.AccountIban,
                payment.Amount.Value,
                payment.VariableSymbol,
                payment.Message,
                payment.DueDate,
                payment.AccountHolder,
                payment.Currency);
        }

        return response;
    }
}
