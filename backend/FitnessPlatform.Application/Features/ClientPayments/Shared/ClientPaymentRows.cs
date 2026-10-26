using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Application.Features.ClientPayments.Shared;

/// <summary>
/// Turns an assignment's payments into the rows the coach sees, resolving each upcoming payment against
/// the client's terms as they are now.
/// </summary>
internal static class ClientPaymentRows
{
    /// <summary>
    /// Builds one row per payment, newest due date first.
    /// </summary>
    /// <param name="payments">The assignment's payments.</param>
    /// <param name="terms">The assignment's terms history, packages and discounts loaded.</param>
    /// <param name="messageFormat">How the coach's transfer messages are composed.</param>
    /// <param name="context">The coach and client.</param>
    /// <param name="today">Today in the schedule's zone.</param>
    public static List<ClientPaymentRowDto> Build(
        IReadOnlyCollection<ClientPayment> payments,
        IReadOnlyCollection<ClientPaymentTerms> terms,
        PaymentMessageFormat messageFormat,
        CoachClientContext context,
        DateOnly today)
    {
        var recurringStarts = ClientPaymentSchedule.RecurringStartsOf(payments);

        return payments
            .OrderByDescending(p => p.DueDate)
            .ThenByDescending(p => p.Id)
            .Select(payment =>
            {
                var figures = ClientPaymentSchedule.FiguresOf(payment, terms, recurringStarts);
                var message = payment.Message
                    ?? (payment.Status == ClientPaymentStatus.Upcoming && figures.PackageName is not null
                        ? PaymentMessageComposer.Compose(
                            messageFormat,
                            figures.PackageName,
                            context.ClientFirstName,
                            context.ClientLastName,
                            payment.PeriodStart ?? payment.DueDate)
                        : null);

                return ClientPaymentRowDto.FromEntity(
                    payment,
                    ClientPaymentSchedule.DerivedStatus(payment.Status, payment.DueDate, today),
                    figures,
                    message);
            })
            .ToList();
    }
}
