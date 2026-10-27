using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Unit coverage for <see cref="IbanValidator"/>.
/// </summary>
public class IbanValidatorTests
{
    [Theory]
    [InlineData("CZ6508000000192000145399")]
    [InlineData("cz65 0800 0000 1920 0014 5399")]
    [InlineData("GB82WEST12345698765432")]
    public void IsValid_WellFormedIban_ReturnsTrue(string iban)
    {
        IbanValidator.IsValid(iban).Should().BeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("CZ6508000000192000145398")]
    [InlineData("6508000000192000145399CZ")]
    public void IsValid_BadChecksumOrShape_ReturnsFalse(string? iban)
    {
        IbanValidator.IsValid(iban).Should().BeFalse();
    }

    [Fact]
    public void Normalize_SpacedLowerCase_StripsAndUpperCases()
    {
        IbanValidator.Normalize(" cz65 0800 0000 1920 0014 5399 ").Should().Be("CZ6508000000192000145399");
    }

    [Fact]
    public void Mask_NormalizedIban_KeepsOnlyCountryCheckDigitsAndLastFour()
    {
        IbanValidator.Mask("CZ6508000000192000145399").Should().Be("CZ65 **** 5399");
    }
}
