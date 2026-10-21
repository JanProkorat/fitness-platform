using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Decides whether a coach discount applies to a payment and what it takes off the price.
/// </summary>
public static class CoachDiscountRules
{
    /// <summary>
    /// Whether the discount applies to a payment: it is not archived, the due date is inside the validity
    /// window (both ends inclusive, an open end is unbounded), and the payment's ordinal is within the covered count.
    /// </summary>
    /// <param name="discount">The discount.</param>
    /// <param name="paymentOrdinal">Which payment of the client this is, counting from 1.</param>
    /// <param name="dueDate">The payment's due date.</param>
    public static bool Applies(CoachDiscount discount, int paymentOrdinal, DateOnly dueDate)
    {
        if (discount.ArchivedAt is not null)
        {
            return false;
        }

        if (discount.ValidFrom is { } validFrom && dueDate < validFrom)
        {
            return false;
        }

        if (discount.ValidTo is { } validTo && dueDate > validTo)
        {
            return false;
        }

        return discount.Duration != DiscountDuration.FirstPayments
            || paymentOrdinal <= discount.DurationPayments;
    }

    /// <summary>
    /// The price after the discount, rounded to two decimals and never below zero.
    /// </summary>
    /// <param name="discount">The discount.</param>
    /// <param name="price">The price before the discount.</param>
    public static decimal Apply(CoachDiscount discount, decimal price)
    {
        var discounted = discount.Type == DiscountType.Percentage
            ? price * (100m - discount.Value) / 100m
            : price - discount.Value;

        return Math.Max(0m, Math.Round(discounted, 2, MidpointRounding.AwayFromZero));
    }
}
