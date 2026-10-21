using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A coach's payment settings: the bank account clients pay into and how payment requests are
/// composed. One row per professional.
/// </summary>
public class CoachPaymentSettings : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the owning <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Normalized IBAN (no spaces, upper case). Null until the coach sets an account.
    /// </summary>
    [MaxLength(34)]
    public string? Iban { get; set; }

    /// <summary>
    /// Name of the account holder. Null until the coach sets an account.
    /// </summary>
    [MaxLength(140)]
    public string? AccountHolder { get; set; }

    /// <summary>
    /// Days after a payment request is issued that it falls due.
    /// </summary>
    public int PaymentDueDays { get; set; } = 7;

    /// <summary>
    /// How the payment message is composed.
    /// </summary>
    public PaymentMessageFormat MessageFormat { get; set; } = PaymentMessageFormat.PackageNameAndMonth;

    /// <summary>
    /// How the variable symbol is derived.
    /// </summary>
    public VariableSymbolFormat VariableSymbolFormat { get; set; } = VariableSymbolFormat.YearMonthClientNumber;

    /// <summary>
    /// When the bank account was last set or changed (UTC). Null until an account is set.
    /// </summary>
    public DateTime? BankAccountChangedAt { get; set; }

    /// <summary>
    /// Navigation property to the owning professional.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
