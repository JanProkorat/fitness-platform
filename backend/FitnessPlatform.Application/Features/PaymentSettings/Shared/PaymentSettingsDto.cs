using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PaymentSettings.Shared;

/// <summary>
/// A coach's payment settings as shown to the coach — reused by the get, update and change actions.
/// </summary>
public class PaymentSettingsDto
{
    /// <summary>Normalized IBAN, or null until an account is set.</summary>
    public string? Iban { get; set; }

    /// <summary>Account holder name, or null until an account is set.</summary>
    public string? AccountHolder { get; set; }

    /// <summary>Days after a payment request is issued that it falls due.</summary>
    public int PaymentDueDays { get; set; }

    /// <summary>How the payment message is composed.</summary>
    public PaymentMessageFormat MessageFormat { get; set; }

    /// <summary>How the variable symbol is derived.</summary>
    public VariableSymbolFormat VariableSymbolFormat { get; set; }

    /// <summary>The coach's main currency; the public profile's "from" price is in it.</summary>
    public PaymentCurrency ProfileCurrency { get; set; }

    /// <summary>When the bank account was last set or changed (UTC), or null until one is set.</summary>
    public DateTime? BankAccountChangedAt { get; set; }

    /// <summary>
    /// Maps the settings row to its wire form. A coach with no row yet gets the entity defaults.
    /// </summary>
    /// <param name="settings">The stored settings, or null when the coach has none yet.</param>
    public static PaymentSettingsDto FromEntity(CoachPaymentSettings? settings)
    {
        settings ??= new CoachPaymentSettings();

        return new PaymentSettingsDto
        {
            Iban = settings.Iban,
            AccountHolder = settings.AccountHolder,
            PaymentDueDays = settings.PaymentDueDays,
            MessageFormat = settings.MessageFormat,
            VariableSymbolFormat = settings.VariableSymbolFormat,
            ProfileCurrency = settings.ProfileCurrency,
            BankAccountChangedAt = settings.BankAccountChangedAt
        };
    }
}
