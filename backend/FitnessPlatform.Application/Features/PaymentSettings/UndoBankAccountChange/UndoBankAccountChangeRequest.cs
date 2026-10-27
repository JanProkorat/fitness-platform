namespace FitnessPlatform.Application.Features.PaymentSettings.UndoBankAccountChange;

/// <summary>
/// Request for undoing a bank account change from the emailed link.
/// </summary>
public class UndoBankAccountChangeRequest
{
    /// <summary>The single-use token from the undo link.</summary>
    public string Token { get; set; } = string.Empty;
}
