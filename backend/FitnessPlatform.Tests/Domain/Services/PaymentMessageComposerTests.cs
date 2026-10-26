using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// The transfer message, the localized number and date formats, and the encoding of the request email.
/// </summary>
public class PaymentMessageComposerTests
{
    private static readonly DateOnly November = new(2026, 11, 1);
    private const char Nbsp = ' ';

    [Fact]
    public void Compose_PackageNameAndMonth_ReadsLikeTheBoard()
    {
        PaymentMessageComposer.Compose(PaymentMessageFormat.PackageNameAndMonth, "Online coaching", "Eva", "Svobodová", November)
            .Should().Be("Online coaching 11/2026");
    }

    [Fact]
    public void Compose_PackageName_IsTheNameOnly()
    {
        PaymentMessageComposer.Compose(PaymentMessageFormat.PackageName, "Online coaching", "Eva", "Svobodová", November)
            .Should().Be("Online coaching");
    }

    [Fact]
    public void Compose_ClientNameAndMonth_UsesTheClientWithoutDiacritics()
    {
        PaymentMessageComposer.Compose(PaymentMessageFormat.ClientNameAndMonth, "Online coaching", "Eva", "Svobodová", November)
            .Should().Be("Eva Svobodova 11/2026");
    }

    [Fact]
    public void Compose_LongPackageName_IsCutToSixtyCharactersKeepingTheMonth()
    {
        var message = PaymentMessageComposer.Compose(
            PaymentMessageFormat.PackageNameAndMonth, new string('A', 90), "Eva", "Svobodová", November);

        message.Length.Should().BeLessThanOrEqualTo(60);
        message.Should().EndWith(" 11/2026");
    }

    [Fact]
    public void Compose_DiacriticsInPackageName_AreStripped()
    {
        PaymentMessageComposer.Compose(PaymentMessageFormat.PackageName, "Tréninkový plán ŽÁDNÝ", "A", "B", November)
            .Should().Be("Treninkovy plan ZADNY");
    }

    [Theory]
    [InlineData(1750, "cs", "1 750 Kč")]
    [InlineData(500, "de", "500 Kč")]
    [InlineData(1234567, "cs", "1 234 567 Kč")]
    public void FormatAmount_GroupsThousandsWithANonBreakingSpace(int amount, string language, string expected)
    {
        PaymentMessageComposer.FormatAmount(amount, language).Should().Be(expected);
    }

    [Theory]
    [InlineData("cs", "1 750,50 €")]
    [InlineData("en", "€1 750.50")]
    public void FormatAmount_Euro_PutsTheSymbolWhereTheLanguageWantsIt(string language, string expected)
    {
        PaymentMessageComposer.FormatAmount(1750.5m, language, PaymentCurrency.EUR)
            .Replace(Nbsp, ' ').Should().Be(expected);
    }

    [Theory]
    [InlineData("cs", "1750,50")]
    [InlineData("en", "1750.50")]
    public void FormatAmount_FractionalAmount_UsesTheLanguagesDecimalSeparator(string language, string digits)
    {
        var text = PaymentMessageComposer.FormatAmount(1750.5m, language);

        text.Replace(Nbsp.ToString(), string.Empty).Should().Be($"{digits}Kč");
    }

    [Theory]
    [InlineData("cs", "1. 11. 2026")]
    [InlineData("de", "01.11.2026")]
    [InlineData("en", "1 November 2026")]
    [InlineData("fr", "1 November 2026")]
    public void FormatDate_FollowsTheReadersConvention(string language, string expected)
    {
        PaymentMessageComposer.FormatDate(November, language).Should().Be(expected);
    }

    [Theory]
    [InlineData("cs", "listopad 2026")]
    [InlineData("en", "November 2026")]
    public void PeriodLabel_CalendarMonth_NamesTheMonth(string language, string expected)
    {
        PaymentMessageComposer.PeriodLabel(November, new DateOnly(2026, 11, 30), "x", language).Should().Be(expected);
    }

    [Fact]
    public void PeriodLabel_PartialPeriod_ShowsBothDates()
    {
        PaymentMessageComposer.PeriodLabel(new DateOnly(2026, 10, 15), new DateOnly(2026, 10, 28), "x", "en")
            .Should().Be("15 October 2026 – 28 October 2026");
    }

    [Fact]
    public void PeriodLabel_NoPeriod_IsTheTitle()
    {
        PaymentMessageComposer.PeriodLabel(null, null, "Workshop", "cs").Should().Be("Workshop");
    }

    [Fact]
    public void FormatIban_GroupsInFours()
    {
        PaymentMessageComposer.FormatIban("CZ6508000000192000145399").Should().Be("CZ65 0800 0000 1920 0014 5399");
    }

    private static PaymentRequestEmail Email(string coach = "Martin Král", string package = "Online coaching") => new(
        "eva@example.com",
        "cs",
        coach,
        package,
        November,
        new DateOnly(2026, 11, 30),
        1750m,
        2500m,
        "Friends & family −30 %",
        November,
        "CZ6508000000192000145399",
        "2026110142",
        "Online coaching 11/2026",
        [1, 2, 3],
        PaymentMessageComposer.QrContentId);

    [Fact]
    public void EmailSubject_Czech_NamesCoachAmountPeriodAndDueDate()
    {
        PaymentMessageComposer.EmailSubject(Email(), "cs")
            .Should().Be($"Martin Král: 1{Nbsp}750{Nbsp}Kč za listopad 2026, splatnost 1. 11. 2026");
    }

    [Fact]
    public void EmailSubject_English_UsesTheEnglishWording()
    {
        PaymentMessageComposer.EmailSubject(Email(), "en")
            .Should().Be($"Martin Král: 1{Nbsp}750{Nbsp}Kč for November 2026, due 1 November 2026");
    }

    [Fact]
    public void RenderEmailHtml_FillsEveryPlaceholderAndRefersToTheQrByContentId()
    {
        var html = PaymentMessageComposer.RenderEmailHtml(
            "{{Heading}}|{{Intro}}|{{Amount}}|{{Iban}}|{{VariableSymbol}}|{{Message}}|{{Due}}|{{Breakdown}}|{{CoachName}}|{{QrCid}}|{{AppUrl}}",
            Email(),
            "en",
            "https://app.example.com");

        html.Should().NotContain("{{");
        html.Should().Contain("CZ65 0800 0000 1920 0014 5399").And.Contain("2026110142").And.Contain("Online coaching 11/2026");
        html.Should().Contain(PaymentMessageComposer.QrContentId).And.Contain("https://app.example.com");
        html.Should().Contain("Package price 2").And.Contain("Friends &amp; family");
    }

    [Fact]
    public void RenderEmailHtml_HtmlInCoachAndPackageNames_IsEncoded()
    {
        var html = PaymentMessageComposer.RenderEmailHtml(
            "{{Heading}}|{{CoachName}}",
            Email(coach: "<script>alert(1)</script>", package: "<b>Evil</b> & co"),
            "en",
            "https://app.example.com");

        html.Should().NotContain("<script>").And.NotContain("<b>");
        html.Should().Contain("&lt;script&gt;").And.Contain("&lt;b&gt;Evil&lt;/b&gt; &amp; co");
    }

    [Fact]
    public void RenderEmailHtml_NoDiscount_LeavesTheBreakdownLineEmpty()
    {
        var withoutDiscount = Email() with { DiscountLabel = null, BasePrice = null };

        PaymentMessageComposer.RenderEmailHtml("[{{Breakdown}}]", withoutDiscount, "en", "https://app.example.com")
            .Should().Be("[]");
    }

    [Theory]
    [InlineData("en", "Custom price")]
    [InlineData("cs", "Individuální cena")]
    [InlineData("de", "Individueller Preis")]
    public void RenderEmailHtml_CustomPrice_UsesTheRecipientsLanguage(string language, string expected)
    {
        var custom = Email() with { DiscountLabel = null, IsCustomPrice = true };

        var html = PaymentMessageComposer.RenderEmailHtml("[{{Breakdown}}]", custom, language, "https://app.example.com");

        System.Net.WebUtility.HtmlDecode(html).Should().Contain(expected);
    }
}
