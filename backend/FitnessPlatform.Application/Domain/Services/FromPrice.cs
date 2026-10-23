using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The cheapest package price on a coach's profile and how that package is billed.
/// </summary>
/// <param name="Amount">The raw package price.</param>
/// <param name="Currency">The coach's main currency.</param>
/// <param name="Billing">How the cheapest package is billed.</param>
/// <param name="IntervalWeeks">Weeks between payments; set only for <see cref="PackageBillingInterval.EveryNWeeks"/>.</param>
public readonly record struct FromPrice(
    decimal Amount,
    PaymentCurrency Currency,
    PackageBillingInterval Billing,
    int? IntervalWeeks);
