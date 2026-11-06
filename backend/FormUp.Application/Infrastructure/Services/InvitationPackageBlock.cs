using System.Net;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;

namespace FormUp.Application.Infrastructure.Services;

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
    /// <param name="assetBaseUrl">Public asset base URL without a trailing slash; when null the package icon tile is left out.</param>
    public static string Render(InvitationPackageInfo? package, string language, string? assetBaseUrl = null)
    {
        if (package is null)
        {
            return string.Empty;
        }

        var (label, priceNote) = language switch
        {
            "cs" => ("Balíček", "Cenu a podrobnosti najdete v aplikaci Form Up."),
            "de" => ("Paket", "Preis und Details sehen Sie in der Form-Up-App."),
            _ => ("Package", "See the price and details in the Form Up app.")
        };

        var lines = $"""
                    <p class="fu-muted" style="margin:0 0 2px;font-size:12px;font-weight:600;color:#6B6863;">{label}</p>
                    <p class="fu-text" style="margin:0 0 2px;font-size:15px;font-weight:700;color:#141414;">{WebUtility.HtmlEncode(package.Name)} &middot; {WebUtility.HtmlEncode(BillingLabel(package, language))}</p>
                    <p class="fu-muted" style="margin:0;font-size:13px;line-height:1.5;color:#6B6863;">{priceNote}</p>
              """;

        if (!string.IsNullOrEmpty(assetBaseUrl))
        {
            var icon = EmailTemplateRenderer.IconPair(assetBaseUrl, "package", 18, "");
            lines = $"""
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="36" valign="top" style="width:36px;padding-right:12px;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td class="fu-panel" width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:10px;background-color:#F6F4F0;line-height:0;">{icon}</td>
                            </tr>
                          </table>
                        </td>
                        <td valign="top">
                {lines}
                        </td>
                      </tr>
                    </table>
              """;
        }

        return $"""
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td class="fu-rule" style="border:1px solid #E7E4DE;border-radius:14px;padding:14px 16px;">
              {lines}
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
