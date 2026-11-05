using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Domain.Services;
using FormUp.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// The shared email renderer: every template wrapped in the layout, no leftovers of the old look, user text
/// encoded and never expanded, language fallback, subjects.
/// </summary>
public class EmailTemplateRendererTests
{
    private const string AssetBaseUrl = "https://api.example.com";

    private static readonly string[] Languages = ["cs", "en", "de"];

    private static readonly string[] Templates =
    [
        EmailTemplateRenderer.EmailVerification,
        EmailTemplateRenderer.PasswordReset,
        EmailTemplateRenderer.Invitation,
        EmailTemplateRenderer.PaymentRequest,
        EmailTemplateRenderer.BankAccountChanged,
        EmailTemplateRenderer.ReauthCode
    ];

    public static TheoryData<string, string> EveryTemplateInEveryLanguage()
    {
        var data = new TheoryData<string, string>();

        foreach (var template in Templates)
        {
            foreach (var language in Languages)
            {
                data.Add(template, language);
            }
        }

        return data;
    }

    private static EmailTemplateRenderer Renderer(string? assetBaseUrl = AssetBaseUrl) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:AssetBaseUrl"] = assetBaseUrl
        }).Build());

    private static PaymentRequestEmail Payment(string language) => new(
        "eva@example.com",
        language,
        "Martin Král",
        "Online coaching",
        new DateOnly(2026, 11, 1),
        new DateOnly(2026, 11, 30),
        1750m,
        2500m,
        "Friends & family −30 %",
        new DateOnly(2026, 11, 1),
        "CZ6508000000192000145399",
        "2026110142",
        "Online coaching 11/2026",
        [1, 2, 3],
        PaymentMessageComposer.QrContentId);

    private static string RenderTemplate(EmailTemplateRenderer renderer, string template, string language)
    {
        var values = new Dictionary<string, string>
        {
            ["Email"] = "coach@example.com",
            ["VerifyUrl"] = "https://app.example.com/verify-email?token=abc",
            ["ResetUrl"] = "https://app.example.com/auth/reset-password?token=abc&email=coach%40example.com",
            ["Code"] = "123456",
            ["NewIban"] = "CZ65 **** 5399",
            ["PreviousIban"] = "CZ12 **** 0001",
            ["UndoUrl"] = "https://app.example.com/bank-account/undo?token=abc"
        };

        return template switch
        {
            EmailTemplateRenderer.Invitation => renderer.RenderInvitation(
                "Jan Novák",
                "https://app.example.com/invite/accept?token=abc",
                language,
                "Hi, see you soon.",
                new InvitationPackageInfo("Monthly coaching", PackageBillingInterval.Monthly, null)).Html,
            EmailTemplateRenderer.PaymentRequest => PaymentMessageComposer.RenderEmailHtml(
                renderer.Wrap(template, language), Payment(language), language, "https://app.example.com"),
            _ => renderer.Render(template, language, values).Html
        };
    }

    [Theory]
    [MemberData(nameof(EveryTemplateInEveryLanguage))]
    public void Render_EveryTemplate_IsWrappedInTheSharedLayoutWithNothingLeftOver(string template, string language)
    {
        var html = RenderTemplate(Renderer(), template, language);

        html.Should().Contain($"<html lang=\"{language}\">").And.Contain($"{AssetBaseUrl}/email/formup-logo.png");
        html.Should().Contain("prefers-color-scheme").And.Contain("display:none;max-height:0");
        html.Should().NotContain("{{").And.NotContain("}}");
        html.Should().NotContain("c9a84c").And.NotContain("rgba(201,168,76").And.NotContain("GF Platform")
            .And.NotContain("PLATFORM").And.NotContain("#0d0d0d");
        html.Should().NotContainEquivalentOf("kouč");
    }

    private static readonly string[] RemovedLabels =
    [
        "CONFIRM EMAIL", "POTVRZENÍ E-MAILU", "E-MAIL BESTÄTIGEN",
        "PASSWORD RESET", "OBNOVENÍ HESLA", "PASSWORT ZURÜCKSETZEN",
        "INVITATION", "POZVÁNKA", "EINLADUNG",
        "PAYMENT REQUEST", "ŽÁDOST O PLATBU", "ZAHLUNGSAUFFORDERUNG",
        "SECURITY", "ZABEZPEČENÍ", "SICHERHEIT"
    ];

    [Theory]
    [MemberData(nameof(EveryTemplateInEveryLanguage))]
    public void Render_EveryTemplate_HasNoSmallLabelAboveTheHeading(string template, string language)
    {
        var html = RenderTemplate(Renderer(), template, language);

        html.Should().NotContain("letter-spacing:2px");

        foreach (var label in RemovedLabels)
        {
            html.Should().NotContain(label, "the label above the heading was dropped from every email");
        }
    }

    [Theory]
    [InlineData("cs", "Váš plán. Společně.")]
    [InlineData("en", "Your plan. Together.")]
    [InlineData("de", "Ihr Plan. Gemeinsam.")]
    public void Render_Footer_CarriesTheTranslatedTagline(string language, string tagline)
    {
        var html = Renderer().Render(EmailTemplateRenderer.PasswordReset, language, new Dictionary<string, string>
        {
            ["Email"] = "a@example.com",
            ["ResetUrl"] = "https://app.example.com/r"
        }).Html;

        html.Should().Contain("Form Up &middot; " + tagline);
    }

    [Fact]
    public void Render_NoAssetBaseUrl_ShowsATextWordmarkInsteadOfABrokenImage()
    {
        var html = Renderer(assetBaseUrl: null).Render(EmailTemplateRenderer.ReauthCode, "en", new Dictionary<string, string> { ["Code"] = "1" }).Html;

        html.Should().NotContain("<img").And.Contain("FORM <span");
    }

    [Fact]
    public void Render_AssetBaseUrlWithTrailingSlash_BuildsOneAbsoluteLogoUrl()
    {
        var html = Renderer("https://api.example.com/").Render(EmailTemplateRenderer.ReauthCode, "en", new Dictionary<string, string> { ["Code"] = "1" }).Html;

        html.Should().Contain("src=\"https://api.example.com/email/formup-logo.png\"");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("fr")]
    [InlineData("fr-FR")]
    public void Render_UnknownLanguage_FallsBackToEnglish(string? language)
    {
        var (subject, html) = Renderer().Render(EmailTemplateRenderer.EmailVerification, language, new Dictionary<string, string>
        {
            ["Email"] = "a@example.com",
            ["VerifyUrl"] = "https://app.example.com/v"
        });

        subject.Should().Be("Confirm your email for Form Up");
        html.Should().Contain("<html lang=\"en\">").And.Contain("Confirm your email");
    }

    [Theory]
    [InlineData("cs-CZ", "cs")]
    [InlineData("de-AT", "de")]
    [InlineData("EN", "en")]
    public void NormalizeLanguage_KeepsTheTwoLetterCode(string language, string expected)
    {
        EmailTemplateRenderer.NormalizeLanguage(language).Should().Be(expected);
    }

    [Theory]
    [InlineData("en", "Confirm your email for Form Up", "Reset your Form Up password", "Jan Novák invited you to Form Up")]
    [InlineData("cs", "Potvrďte svůj e-mail pro Form Up", "Obnovení hesla ve Form Up", "Jan Novák vás zve do Form Up")]
    [InlineData("de", "Bestätigen Sie Ihre E-Mail für Form Up", "Form-Up-Passwort zurücksetzen", "Jan Novák hat Sie zu Form Up eingeladen")]
    public void Subjects_MatchTheBoardsInEveryLanguage(string language, string verify, string reset, string invitation)
    {
        var renderer = Renderer();
        var values = new Dictionary<string, string>
        {
            ["Email"] = "a@example.com",
            ["VerifyUrl"] = "https://app.example.com/v",
            ["ResetUrl"] = "https://app.example.com/r"
        };

        renderer.Render(EmailTemplateRenderer.EmailVerification, language, values).Subject.Should().Be(verify);
        renderer.Render(EmailTemplateRenderer.PasswordReset, language, values).Subject.Should().Be(reset);
        renderer.RenderInvitation("Jan Novák", "https://app.example.com/i", language, null, null).Subject.Should().Be(invitation);
    }

    [Fact]
    public void Render_Preheader_IsTheHiddenPreviewTextOfTheBoard()
    {
        var html = Renderer().Render(EmailTemplateRenderer.EmailVerification, "en", new Dictionary<string, string>
        {
            ["Email"] = "a@example.com",
            ["VerifyUrl"] = "https://app.example.com/v"
        }).Html;

        html.Should().Contain("mso-hide:all;\">One click and your account is ready.</div>");
    }

    [Fact]
    public void Render_FooterLine_IsEmptyByDefaultAndShownWhenGiven()
    {
        var values = new Dictionary<string, string> { ["Code"] = "1" };

        Renderer().Render(EmailTemplateRenderer.ReauthCode, "en", values).Html.Should().NotContain("Turn off");
        Renderer().Render(EmailTemplateRenderer.ReauthCode, "en", values, footerLine: "<a href=\"https://x.example\">Turn off</a>")
            .Html.Should().Contain("<a href=\"https://x.example\">Turn off</a><br>");
    }

    [Fact]
    public void RenderInvitation_WithoutPersonalMessage_HasNoQuoteBlock()
    {
        var html = Renderer().RenderInvitation("Jan Novák", "https://app.example.com/i", "en", "  ", null).Html;

        html.Should().NotContain("&ldquo;").And.NotContain("Message from");
    }

    [Fact]
    public void RenderInvitation_WithPersonalMessage_ShowsItUnderTheCoachsFirstName()
    {
        var html = Renderer().RenderInvitation("Jan Novák", "https://app.example.com/i", "en", "Hi Petra, welcome!", null).Html;

        html.Should().Contain("Message from Jan").And.Contain("&ldquo;Hi Petra, welcome!&rdquo;");
        html.Should().Contain("Jan invited you to work together").And.Contain(">JN<");
    }

    [Fact]
    public void RenderInvitation_UserTextWithMarkupAndPlaceholders_IsEncodedAndNotExpanded()
    {
        var package = new InvitationPackageInfo("{{AcceptUrl}} <i>pkg</i>", PackageBillingInterval.Monthly, null);

        var html = Renderer().RenderInvitation(
            "<b>{{PackageBlock}}</b>", "https://app.example.com/accept", "en", "<script>x</script> {{TrainerName}}", package).Html;

        html.Should().NotContain("<script>").And.NotContain("<b>{{").And.NotContain("<i>pkg</i>");
        html.Should().Contain("&lt;script&gt;x&lt;/script&gt; {{TrainerName}}");
        html.Should().Contain("&lt;b&gt;{{PackageBlock}}&lt;/b&gt;");
        html.Should().Contain("{{AcceptUrl}} &lt;i&gt;pkg&lt;/i&gt;");
    }

    [Fact]
    public void RenderInvitation_WithPackage_KeepsThePackageBlock()
    {
        var html = Renderer().RenderInvitation(
            "Jan Novák", "https://app.example.com/i", "cs", null, new InvitationPackageInfo("Online", PackageBillingInterval.Monthly, null)).Html;

        System.Net.WebUtility.HtmlDecode(html).Should().Contain("Balíček").And.Contain("Online · Měsíčně");
    }

    [Fact]
    public void Render_ReauthCode_EncodesTheCode()
    {
        var html = Renderer().Render(EmailTemplateRenderer.ReauthCode, "en", new Dictionary<string, string> { ["Code"] = "<1&2>" }).Html;

        html.Should().Contain("&lt;1&amp;2&gt;").And.NotContain("<1&2>");
    }

    [Fact]
    public void Render_UrlWithQueryString_IsHtmlEncodedInTheHref()
    {
        var html = Renderer().Render(EmailTemplateRenderer.PasswordReset, "en", new Dictionary<string, string>
        {
            ["Email"] = "a@example.com",
            ["ResetUrl"] = "https://app.example.com/r?token=t&email=a%40example.com"
        }).Html;

        html.Should().Contain("href=\"https://app.example.com/r?token=t&amp;email=a%40example.com\"");
    }
}
