using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Auth.RequestPasswordReset;

namespace FitnessPlatform.Tests.Validators;

public class RequestPasswordResetValidatorTests
{
    private readonly RequestPasswordResetValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new RequestPasswordResetRequest
        {
            Email = "test@example.com"
        });
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Email_InvalidOrEmpty_Fails(string email)
    {
        var result = _validator.TestValidate(new RequestPasswordResetRequest
        {
            Email = email
        });
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }
}
