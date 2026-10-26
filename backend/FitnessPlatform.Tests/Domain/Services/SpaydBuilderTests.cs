using System.Globalization;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Pins the SPAYD (QR Platba) string against the limits of the specification.
/// </summary>
public class SpaydBuilderTests
{
    private const string Iban = "CZ6508000000192000145399";

    [Fact]
    public void Build_AllFields_ProducesFieldsInSpecOrder()
    {
        var spayd = SpaydBuilder.Build(
            Iban, 1750m, "2026110142", "Online coaching 11/2026", new DateOnly(2026, 11, 1), "Martin Kral");

        spayd.Should().Be(
            "SPD*1.0*ACC:CZ6508000000192000145399*AM:1750.00*CC:CZK*DT:20261101*MSG:Online coaching 11/2026*RN:Martin Kral*X-VS:2026110142");
    }

    [Fact]
    public void Build_EuroPayment_WritesTheEuroCurrencyCode()
    {
        var spayd = SpaydBuilder.Build(Iban, 10m, null, null, null, null, PaymentCurrency.EUR);

        spayd.Should().Be("SPD*1.0*ACC:CZ6508000000192000145399*AM:10.00*CC:EUR");
    }

    [Fact]
    public void Build_OptionalFieldsMissing_OmitsThem()
    {
        var spayd = SpaydBuilder.Build(Iban, 10m, null, null, null, null);

        spayd.Should().Be("SPD*1.0*ACC:CZ6508000000192000145399*AM:10.00*CC:CZK");
    }

    [Fact]
    public void Build_IbanWithSpacesAndLowerCase_IsNormalizedToIbanOnly()
    {
        var spayd = SpaydBuilder.Build("cz65 0800 0000 1920 0014 5399", 10m, null, null, null, null);

        spayd.Should().Contain("*ACC:CZ6508000000192000145399*").And.NotContain(" ");
    }

    [Fact]
    public void Build_UnderACommaCulture_StillWritesADotDecimalWithTwoDecimals()
    {
        var previous = CultureInfo.CurrentCulture;

        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("cs-CZ");

            SpaydBuilder.Build(Iban, 1234.5m, null, null, null, null).Should().Contain("*AM:1234.50*");
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void Build_LargestAmount_FitsTheTenCharacterLimit()
    {
        var spayd = SpaydBuilder.Build(Iban, 9_999_999.99m, null, null, null, null);

        spayd.Should().Contain("*AM:9999999.99*");
        "9999999.99".Length.Should().Be(10);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(10_000_000)]
    public void Build_AmountOutsideTheLimits_Throws(int amount)
    {
        var act = () => SpaydBuilder.Build(Iban, amount, null, null, null, null);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Theory]
    [InlineData("12345678901")]
    [InlineData("12AB")]
    [InlineData("")]
    public void Build_InvalidVariableSymbol_Throws(string variableSymbol)
    {
        var act = () => SpaydBuilder.Build(Iban, 1m, variableSymbol, null, null, null);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Build_MessageOverSixtyCharacters_IsCutToSixty()
    {
        var spayd = SpaydBuilder.Build(Iban, 1m, null, new string('a', 80), null, null);

        spayd.Should().Contain("*MSG:" + new string('a', 60));
        spayd.Should().NotContain(new string('a', 61));
    }

    [Fact]
    public void Build_RecipientNameOverThirtyFiveCharacters_IsCutToThirtyFive()
    {
        var spayd = SpaydBuilder.Build(Iban, 1m, null, null, null, new string('b', 50));

        spayd.Should().Contain("*RN:" + new string('b', 35));
        spayd.Should().NotContain(new string('b', 36));
    }

    [Fact]
    public void Build_DiacriticsInMessageAndName_AreStrippedToAscii()
    {
        var spayd = SpaydBuilder.Build(Iban, 1m, null, "Žluťoučký kůň, Łódź ß", null, "Příliš Šťastná");

        spayd.Should().Contain("*MSG:Zlutoucky kun, Lodz ss*").And.Contain("*RN:Prilis Stastna");
    }

    [Fact]
    public void Build_AsteriskInText_IsPercentEncoded()
    {
        var spayd = SpaydBuilder.Build(Iban, 1m, null, "Q1*bonus", null, "A*B");

        spayd.Should().Contain("*MSG:Q1%2Abonus*").And.Contain("*RN:A%2AB");
    }

    [Fact]
    public void Build_PercentAndAsteriskInText_PercentIsEncodedFirst()
    {
        var spayd = SpaydBuilder.Build(Iban, 1m, null, "10% off*now", null, "5%*");

        spayd.Should().Contain("*MSG:10%25 off%2Anow*").And.Contain("*RN:5%25%2A");
    }

    [Fact]
    public void Build_MessageIsCutBeforeEncoding_SoTheLimitCountsCharacters()
    {
        var spayd = SpaydBuilder.Build(Iban, 1m, null, new string('*', 70), null, null);

        spayd.Should().Contain("*MSG:" + string.Concat(Enumerable.Repeat("%2A", 60)));
    }

    [Fact]
    public void Build_EmptyIban_Throws()
    {
        var act = () => SpaydBuilder.Build(" ", 1m, null, null, null, null);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ToAscii_NonLatinCharacters_BecomeSpacesAndAreCollapsed()
    {
        SpaydBuilder.ToAscii("Pay  中文  now\t!").Should().Be("Pay now !");
    }
}
