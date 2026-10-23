using System.Net;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Renders the package block of the invitation email: the package name and how it is billed, with a pointer to
/// the app for the price. Shared by both email services.
/// </summary>
internal static class InvitationPackageBlock
{
    /// <summary>
    /// The HTML that replaces the template's package placeholder; empty when the invitation has no package.
    /// </summary>
    /// <param name="package">The package, or null.</param>
    /// <param name="language">A supported language code (en, cs, de).</param>
    public static string Render(InvitationPackageInfo? package, string language)
    {
        if (package is null)
        {
            return string.Empty;
        }

        var (label, priceNote) = language switch
        {
            "cs" => ("Balíček", "Cenu najdete v aplikaci."),
            "de" => ("Paket", "Den Preis sehen Sie in der App."),
            _ => ("Package", "See the price in the app.")
        };

        return $"""
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:4px;padding:16px 20px;text-align:center;">
                    <span style="font-size:10px;font-weight:700;letter-spacing:3px;color:#8a6f2e;text-transform:uppercase;">{label}</span>
                    <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:#f0ece4;">{WebUtility.HtmlEncode(package.Name)}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#a89f8c;">{WebUtility.HtmlEncode(BillingLabel(package, language))}</p>
                    <p style="margin:8px 0 0;font-size:12px;color:#5a5248;">{priceNote}</p>
                  </td>
                </tr>
              </table>
              """;
    }

    /// <summary>
    /// The translated billing rhythm: monthly, every N weeks or one-off.
    /// </summary>
    /// <param name="package">The package.</param>
    /// <param name="language">A supported language code (en, cs, de).</param>
    internal static string BillingLabel(InvitationPackageInfo package, string language)
    {
        var weeks = Math.Max(1, package.IntervalWeeks ?? 1);

        return package.Billing switch
        {
            PackageBillingInterval.Monthly => language switch
            {
                "cs" => "Měsíčně",
                "de" => "Monatlich",
                _ => "Monthly"
            },
            PackageBillingInterval.EveryNWeeks => language switch
            {
                "cs" => weeks switch
                {
                    1 => "Každý týden",
                    >= 2 and <= 4 => $"Každé {weeks} týdny",
                    _ => $"Každých {weeks} týdnů"
                },
                "de" => weeks == 1 ? "Wöchentlich" : $"Alle {weeks} Wochen",
                _ => weeks == 1 ? "Weekly" : $"Every {weeks} weeks"
            },
            _ => language switch
            {
                "cs" => "Jednorázová platba",
                "de" => "Einmalzahlung",
                _ => "One-off payment"
            }
        };
    }
}
