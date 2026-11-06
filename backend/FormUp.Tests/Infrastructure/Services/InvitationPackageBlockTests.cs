using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Interfaces;
using FormUp.Application.Infrastructure.Services;
using FluentAssertions;

namespace FormUp.Tests.Infrastructure.Services;

/// <summary>
/// The package block of the invitation email: encoded name, translated billing rhythm, never a price.
/// </summary>
public class InvitationPackageBlockTests
{
    [Fact]
    public void Render_WithoutPackage_IsEmpty()
    {
        InvitationPackageBlock.Render(null, "en").Should().BeEmpty();
    }

    [Fact]
    public void Render_PackageNameFromTheCoach_IsHtmlEncodedAndPointsToTheAppForThePrice()
    {
        var package = new InvitationPackageInfo("<b>Online & more</b>", PackageBillingInterval.Monthly, null);

        var html = InvitationPackageBlock.Render(package, "en");

        html.Should().Contain("&lt;b&gt;Online &amp; more&lt;/b&gt;").And.NotContain("<b>Online");
        html.Should().Contain("See the price and details in the Form Up app.").And.Contain("Monthly");
    }

    [Fact]
    public void Render_UsesTheFormUpPaletteNotTheOldGoldOne()
    {
        var html = InvitationPackageBlock.Render(new InvitationPackageInfo("Package", PackageBillingInterval.Monthly, null), "en");

        html.Should().NotContain("c9a84c").And.NotContain("rgba(201,168,76").And.NotContain("#8a6f2e").And.NotContain("#f0ece4");
        html.Should().Contain("#E7E4DE");
    }

    [Theory]
    [InlineData("en", PackageBillingInterval.Monthly, null, "Monthly")]
    [InlineData("cs", PackageBillingInterval.Monthly, null, "Měsíčně")]
    [InlineData("de", PackageBillingInterval.Monthly, null, "Monatlich")]
    [InlineData("en", PackageBillingInterval.EveryNWeeks, 6, "Every 6 weeks")]
    [InlineData("cs", PackageBillingInterval.EveryNWeeks, 3, "Každé 3 týdny")]
    [InlineData("cs", PackageBillingInterval.EveryNWeeks, 6, "Každých 6 týdnů")]
    [InlineData("de", PackageBillingInterval.EveryNWeeks, 2, "Alle 2 Wochen")]
    [InlineData("cs", PackageBillingInterval.OneOff, null, "Jednorázová platba")]
    [InlineData("de", PackageBillingInterval.OneOff, null, "Einmalzahlung")]
    public void BillingLabel_IsTranslatedPerLanguage(string language, PackageBillingInterval billing, int? weeks, string expected)
    {
        var package = new InvitationPackageInfo("Package", billing, weeks);

        InvitationPackageBlock.BillingLabel(package, language).Should().Be(expected);
    }

    [Fact]
    public void Render_WithAssetBaseUrl_AddsTheSquarePackageIconTile()
    {
        var package = new InvitationPackageInfo("Package", PackageBillingInterval.Monthly, null);

        var html = InvitationPackageBlock.Render(package, "en", "https://api.example.com");

        html.Should().Contain("src=\"https://api.example.com/email/icons/package-light.png\"")
            .And.Contain("src=\"https://api.example.com/email/icons/package-dark.png\"");
        html.Should().Contain("width=\"36\" height=\"36\"").And.Contain("border-radius:10px").And.Contain("background-color:#F6F4F0")
            .And.Contain("width=\"18\" height=\"18\" alt=\"\"");
    }

    [Fact]
    public void Render_WithoutAssetBaseUrl_HasNoIconTile()
    {
        var package = new InvitationPackageInfo("Package", PackageBillingInterval.Monthly, null);

        var html = InvitationPackageBlock.Render(package, "en");

        html.Should().NotContain("<img").And.NotContain("width=\"36\"");
    }

    [Theory]
    [InlineData("cs", "Cenu a podrobnosti najdete v aplikaci Form Up.")]
    [InlineData("de", "Preis und Details sehen Sie in der Form-Up-App.")]
    public void Render_PriceNoteIsLocalizedAndAddressesTheClientFormally(string language, string note)
    {
        var package = new InvitationPackageInfo("Package", PackageBillingInterval.OneOff, null);

        InvitationPackageBlock.Render(package, language).Should().Contain(note);
    }
}
