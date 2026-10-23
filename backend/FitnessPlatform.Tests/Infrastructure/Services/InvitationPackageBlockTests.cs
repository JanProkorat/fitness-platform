using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Infrastructure.Services;

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
        html.Should().Contain("See the price in the app.").And.Contain("Monthly");
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

    [Theory]
    [InlineData("cs", "Cenu najdete v aplikaci.")]
    [InlineData("de", "Den Preis sehen Sie in der App.")]
    public void Render_PriceNoteIsLocalizedAndAddressesTheClientFormally(string language, string note)
    {
        var package = new InvitationPackageInfo("Package", PackageBillingInterval.OneOff, null);

        InvitationPackageBlock.Render(package, language).Should().Contain(note);
    }
}
