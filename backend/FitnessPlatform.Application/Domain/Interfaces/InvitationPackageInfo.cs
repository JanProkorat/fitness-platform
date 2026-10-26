using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// The package an invitation email names. It never carries a price: the invited client sees that in the app.
/// </summary>
/// <param name="Name">Display name of the package, written by the coach.</param>
/// <param name="Billing">How often the package is billed.</param>
/// <param name="IntervalWeeks">Weeks between payments for <see cref="PackageBillingInterval.EveryNWeeks"/>.</param>
public sealed record InvitationPackageInfo(string Name, PackageBillingInterval Billing, int? IntervalWeeks);
