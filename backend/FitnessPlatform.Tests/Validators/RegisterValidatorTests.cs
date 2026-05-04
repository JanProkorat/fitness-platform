using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Auth.Register;

namespace FitnessPlatform.Tests.Validators;

public class RegisterValidatorTests
{
    private readonly RegisterValidator _validator = new();

    private static RegisterRequest ValidRequest() => new()
    {
        Email = "test@example.com",
        Password = "TestPass1!",
        ConfirmPassword = "TestPass1!",
        FirstName = "John",
        LastName = "Doe",
        Roles = new List<string> { "Client" },
        GdprConsent = true
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Email_Invalid_Fails(string email)
    {
        var req = ValidRequest();
        req.Email = email;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Email_TooLong_Fails()
    {
        var req = ValidRequest();
        req.Email = new string('a', 92) + "@test.com";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    public void Password_TooShortOrEmpty_Fails(string password)
    {
        var req = ValidRequest();
        req.Password = password;
        req.ConfirmPassword = password;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Password_TooLong_Fails()
    {
        var req = ValidRequest();
        req.Password = new string('A', 101);
        req.ConfirmPassword = req.Password;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void ConfirmPassword_Mismatch_Fails()
    {
        var req = ValidRequest();
        req.ConfirmPassword = "DifferentPass1!";
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ConfirmPassword)
            .WithErrorMessage("Passwords do not match.");
    }

    [Theory]
    [InlineData("")]
    public void FirstName_Empty_Fails(string firstName)
    {
        var req = ValidRequest();
        req.FirstName = firstName;
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void FirstName_TooLong_Fails()
    {
        var req = ValidRequest();
        req.FirstName = new string('A', 51);
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void LastName_Empty_Fails()
    {
        var req = ValidRequest();
        req.LastName = "";
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void LastName_TooLong_Fails()
    {
        var req = ValidRequest();
        req.LastName = new string('A', 51);
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void Roles_Empty_Fails()
    {
        var req = ValidRequest();
        req.Roles = new List<string>();
        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Roles);
    }

    [Theory]
    [InlineData("InvalidRole")]
    [InlineData("SuperAdmin")]
    public void Roles_ContainsInvalidRole_Fails(string invalidRole)
    {
        var req = ValidRequest();
        req.Roles = new List<string> { invalidRole };
        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("Client")]
    [InlineData("Trainer")]
    [InlineData("Nutritionist")]
    [InlineData("Admin")]
    public void Roles_SingleValidRole_Passes(string role)
    {
        var req = ValidRequest();
        req.Roles = new List<string> { role };
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Roles);
    }

    [Fact]
    public void Roles_TrainerAndNutritionist_Passes()
    {
        var req = ValidRequest();
        req.Roles = new List<string> { "Trainer", "Nutritionist" };
        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Roles);
    }

    [Fact]
    public void Roles_ClientAndTrainer_Fails()
    {
        var req = ValidRequest();
        req.Roles = new List<string> { "Client", "Trainer" };
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Roles)
            .WithErrorMessage("Cannot combine Client role with Trainer or Nutritionist.");
    }

    [Fact]
    public void Roles_ClientAndNutritionist_Fails()
    {
        var req = ValidRequest();
        req.Roles = new List<string> { "Client", "Nutritionist" };
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Roles)
            .WithErrorMessage("Cannot combine Client role with Trainer or Nutritionist.");
    }

    [Fact]
    public void GdprConsent_False_Fails()
    {
        var req = ValidRequest();
        req.GdprConsent = false;
        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.GdprConsent)
            .WithErrorMessage("GDPR consent is required to register.");
    }
}
