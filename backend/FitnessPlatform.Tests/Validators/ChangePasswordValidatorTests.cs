using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Users.ChangePassword;

namespace FitnessPlatform.Tests.Validators;

public class ChangePasswordValidatorTests
{
    private readonly ChangePasswordValidator _validator = new();

    private static ChangePasswordRequest ValidRequest() => new()
    {
        CurrentPassword = "OldPass123!",
        NewPassword = "NewPass456!",
        ConfirmPassword = "NewPass456!"
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        _validator.TestValidate(ValidRequest()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void CurrentPassword_Empty_Fails()
    {
        var req = ValidRequest();
        req.CurrentPassword = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.CurrentPassword);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Short1")]
    public void NewPassword_EmptyOrTooShort_Fails(string password)
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
        req.NewPassword = "Aa1" + new string('x', 98);
        req.ConfirmPassword = req.NewPassword;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword);
    }

    [Theory]
    [InlineData("lowercase123!", "Password must contain at least one uppercase letter.")]
    [InlineData("UPPERCASE123!", "Password must contain at least one lowercase letter.")]
    [InlineData("NoDigitsHere!", "Password must contain at least one digit.")]
    public void NewPassword_BreaksPolicy_FailsWithActionableMessage(string password, string message)
    {
        var req = ValidRequest();
        req.NewPassword = password;
        req.ConfirmPassword = password;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.NewPassword)
            .WithErrorMessage(message);
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
