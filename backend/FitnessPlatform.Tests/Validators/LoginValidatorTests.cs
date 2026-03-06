using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Auth.Login;

namespace FitnessPlatform.Tests.Validators;

public class LoginValidatorTests
{
    private readonly LoginValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new LoginRequest
        {
            Email = "test@example.com",
            Password = "TestPass1!"
        });
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Email_InvalidOrEmpty_Fails(string email)
    {
        var result = _validator.TestValidate(new LoginRequest
        {
            Email = email,
            Password = "TestPass1!"
        });
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Password_Empty_Fails()
    {
        var result = _validator.TestValidate(new LoginRequest
        {
            Email = "test@example.com",
            Password = ""
        });
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }
}
