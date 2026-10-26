using FitnessPlatform.Application.Domain.Services;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// Time-shifting helper for payment-terms fixtures that must stay valid across DST changes.
/// </summary>
public static class PaymentTermsAging
{
    /// <summary>
    /// Shifts a UTC instant by whole months on the payment schedule's local calendar, so a local midnight stays a local midnight.
    /// </summary>
    public static DateTime ShiftMonths(DateTime utc, int months)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), ClientPaymentSchedule.Zone);
        var shifted = DateTime.SpecifyKind(local.AddMonths(months), DateTimeKind.Unspecified);

        return DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeToUtc(shifted, ClientPaymentSchedule.Zone), DateTimeKind.Utc);
    }
}
