namespace FitnessPlatform.Application.Features.PaymentSettings.ChangeBankAccount;

/// <summary>
/// Request for setting or changing the coach's bank account. Needs a password, or — for an account
/// with no password — a code emailed through the send-code action.
/// </summary>
public class ChangeBankAccountRequest
{
    /// <summary>The IBAN. Spaces and lower case are accepted and normalized.</summary>
    public string Iban { get; set; } = string.Empty;

    /// <summary>Name of the account holder.</summary>
    public string AccountHolder { get; set; } = string.Empty;

    /// <summary>The caller's current password. Required when the account has a password.</summary>
    public string? Password { get; set; }

    /// <summary>The emailed one-time code. Required when the account has no password.</summary>
    public string? Code { get; set; }
}
