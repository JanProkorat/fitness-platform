using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientTags.UpdateClientTag;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators.ClientTags;

/// <summary>
/// Tests for <see cref="UpdateClientTagValidator"/>.
/// </summary>
public class UpdateClientTagValidatorTests
{
    private readonly UpdateClientTagValidator _validator = new();

    private static UpdateClientTagRequest ValidRequest() => new()
    {
        TagId = Guid.NewGuid(),
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
    public void TagId_Empty_FailsWithRequired()
    {
        var req = ValidRequest();
        req.TagId = Guid.Empty;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.TagId).WithErrorCode(ErrorCodes.Required);
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
    public void ColorHex_NotSixDigitHex_FailsWithOutOfRange()
    {
        var req = ValidRequest();
        req.ColorHex = "not-a-color";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ColorHex).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
