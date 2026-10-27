using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PaymentSettings.UpdatePaymentSettings;

/// <summary>
/// Request for updating the payment request defaults. The bank account has its own action.
/// </summary>
public class UpdatePaymentSettingsRequest
{
    /// <summary>Days after a payment request is issued that it falls due (1-90).</summary>
    public int PaymentDueDays { get; set; }

    /// <summary>How the payment message is composed.</summary>
    public PaymentMessageFormat MessageFormat { get; set; }

    /// <summary>How the variable symbol is derived.</summary>
    public VariableSymbolFormat VariableSymbolFormat { get; set; }

    /// <summary>The coach's main currency; omit to keep the stored one.</summary>
    public PaymentCurrency? ProfileCurrency { get; set; }
}
