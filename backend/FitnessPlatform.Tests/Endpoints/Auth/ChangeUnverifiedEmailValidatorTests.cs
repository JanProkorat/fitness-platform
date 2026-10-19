using FitnessPlatform.Application.Features.Auth.ChangeUnverifiedEmail;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Auth;

/// <summary>
/// Unit tests for <see cref="ChangeUnverifiedEmailValidator"/>.
/// </summary>
public class ChangeUnverifiedEmailValidatorTests
{
    private readonly ChangeUnverifiedEmailValidator _validator = new();

    [Fact]
    public void Validate_ValidEmail_Passes()
    {
        var result = _validator.TestValidate(new ChangeUnverifiedEmailRequest { NewEmail = "fixed@example.com" });

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Validate_EmptyOrMalformedEmail_Fails(string newEmail)
    {
        var result = _validator.TestValidate(new ChangeUnverifiedEmailRequest { NewEmail = newEmail });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmailOverMaxLength_Fails()
    {
        var tooLong = new string('a', 95) + "@b.com";

        var result = _validator.TestValidate(new ChangeUnverifiedEmailRequest { NewEmail = tooLong });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmailAtMaxLength_Passes()
    {
        var atLimit = new string('a', 94) + "@b.com";

        var result = _validator.TestValidate(new ChangeUnverifiedEmailRequest { NewEmail = atLimit });

        result.IsValid.Should().BeTrue();
    }
}
