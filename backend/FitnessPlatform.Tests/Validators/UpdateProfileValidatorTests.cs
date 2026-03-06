using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.Users.UpdateProfile;

namespace FitnessPlatform.Tests.Validators;

public class UpdateProfileValidatorTests
{
    private readonly UpdateProfileValidator _validator = new();

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(new UpdateProfileRequest
        {
            FirstName = "John",
            LastName = "Doe"
        });
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void FirstName_Empty_Fails()
    {
        var result = _validator.TestValidate(new UpdateProfileRequest
        {
            FirstName = "",
            LastName = "Doe"
        });
        result.ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void FirstName_TooLong_Fails()
    {
        var result = _validator.TestValidate(new UpdateProfileRequest
        {
            FirstName = new string('A', 51),
            LastName = "Doe"
        });
        result.ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void LastName_Empty_Fails()
    {
        var result = _validator.TestValidate(new UpdateProfileRequest
        {
            FirstName = "John",
            LastName = ""
        });
        result.ShouldHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void LastName_TooLong_Fails()
    {
        var result = _validator.TestValidate(new UpdateProfileRequest
        {
            FirstName = "John",
            LastName = new string('A', 51)
        });
        result.ShouldHaveValidationErrorFor(x => x.LastName);
    }
}
