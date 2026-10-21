namespace FitnessPlatform.Application.Features.PaymentSettings.GetCoachBankDetails;

/// <summary>
/// The bank account a client pays a linked coach into.
/// </summary>
public class GetCoachBankDetailsResponse
{
    /// <summary>Normalized IBAN.</summary>
    public string Iban { get; set; } = string.Empty;

    /// <summary>Name of the account holder.</summary>
    public string AccountHolder { get; set; } = string.Empty;

    /// <summary>Days after a payment request is issued that it falls due.</summary>
    public int PaymentDueDays { get; set; }
}
