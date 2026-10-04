using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientTags.CreateClientTag;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators.ClientTags;

/// <summary>
/// Tests for <see cref="CreateClientTagValidator"/>.
/// </summary>
public class CreateClientTagValidatorTests
{
    private readonly CreateClientTagValidator _validator = new();

    private static CreateClientTagRequest ValidRequest() => new()
    {
        Name = "VIP",
        Description = "High-value client",
        ColorHex = "#3b82f6",
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Name_Empty_FailsWithRequired()
    {
        var req = ValidRequest();
        req.Name = "";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Name_TooLong_FailsWithOutOfRange()
    {
        var req = ValidRequest();
        req.Name = new string('a', 51);

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Description_TooLong_FailsWithOutOfRange()
    {
        var req = ValidRequest();
        req.Description = new string('a', 501);

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Description).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void ColorHex_Empty_FailsWithRequired()
    {
        var req = ValidRequest();
        req.ColorHex = "";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ColorHex).WithErrorCode(ErrorCodes.Required);
    }

    [Theory]
    [InlineData("blue")]
    [InlineData("#fff")]
    [InlineData("#gggggg")]
    [InlineData("3b82f6")]
    [InlineData("#3b82f6\n")]
    public void ColorHex_NotSixDigitHex_FailsWithOutOfRange(string colorHex)
    {
        var req = ValidRequest();
        req.ColorHex = colorHex;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ColorHex).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void ColorHex_UppercaseSixDigitHex_PassesValidation()
    {
        var req = ValidRequest();
        req.ColorHex = "#3B82F6";

        var result = _validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.ColorHex);
    }
}
