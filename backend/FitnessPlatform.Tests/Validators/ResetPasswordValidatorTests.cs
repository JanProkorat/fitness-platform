using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Auth.ResetPassword;

namespace FitnessPlatform.Tests.Validators;

public class ResetPasswordValidatorTests
{
    private readonly ResetPasswordValidator _validator = new();

    private static ResetPasswordRequest ValidRequest() => new()
    {
        Token = "valid-reset-token",
        Email = "test@example.com",
        NewPassword = "NewPass123!",
        ConfirmPassword = "NewPass123!"
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Token_Empty_Fails()
    {
        var req = ValidRequest();
        req.Token = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Email_InvalidOrEmpty_Fails(string email)
    {
        var req = ValidRequest();
        req.Email = email;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    public void NewPassword_TooShortOrEmpty_Fails(string password)
    {
        var req = ValidRequest();
        req.NewPassword = password;
        req.ConfirmPassword = password;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword);
    }

    [Fact]
    public void NewPassword_TooLong_Fails()
    {
        var req = ValidRequest();
        req.NewPassword = new string('A', 101);
        req.ConfirmPassword = req.NewPassword;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword);
    }

    /// <summary>
    /// Regression coverage for #692: the validator must mirror the Identity
    /// password policy (uppercase / lowercase / digit) so a policy-violating
    /// password for a valid-token user is rejected here — with an actionable
    /// message — rather than reaching <c>ResetPasswordAsync</c> and being
    /// collapsed into the endpoint's generic enumeration-safe error.
    /// </summary>
    [Fact]
    public void NewPassword_MissingUppercase_FailsWithActionableMessage()
    {
        var req = ValidRequest();
        req.NewPassword = "lowercase123!";
        req.ConfirmPassword = req.NewPassword;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword)
            .WithErrorMessage("Password must contain at least one uppercase letter.");
    }

    [Fact]
    public void NewPassword_MissingLowercase_FailsWithActionableMessage()
    {
        var req = ValidRequest();
        req.NewPassword = "UPPERCASE123!";
        req.ConfirmPassword = req.NewPassword;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword)
            .WithErrorMessage("Password must contain at least one lowercase letter.");
    }

    [Fact]
    public void NewPassword_MissingDigit_FailsWithActionableMessage()
    {
        var req = ValidRequest();
        req.NewPassword = "NoDigitsHere!";
        req.ConfirmPassword = req.NewPassword;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword)
            .WithErrorMessage("Password must contain at least one digit.");
    }

    [Fact]
    public void ConfirmPassword_Mismatch_Fails()
    {
        var req = ValidRequest();
        req.ConfirmPassword = "DifferentPass1!";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.ConfirmPassword)
            .WithErrorMessage("Passwords do not match.");
    }

    [Fact]
    public void ConfirmPassword_Empty_Fails()
    {
        var req = ValidRequest();
        req.ConfirmPassword = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.ConfirmPassword);
    }
}
