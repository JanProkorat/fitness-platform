using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.CreateFoodTag;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="CreateFoodTagValidator"/>.
/// </summary>
public class CreateFoodTagValidatorTests
{
    private static CreateFoodTagRequest ValidRequest() => new()
    {
        Name = "High Protein",
        Description = "Protein-forward foods",
        ColorHex = "#3b82f6",
    };

    [Fact]
    public void Validate_EmptyName_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.Name = "";

        var result = new CreateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_NameOverMaxLength_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.Name = new string('a', 51);

        var result = new CreateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_DescriptionOverMaxLength_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.Description = new string('a', 501);

        var result = new CreateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Description).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_EmptyColorHex_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.ColorHex = "";

        var result = new CreateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.ColorHex).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_ColorHexNotSixDigitHex_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.ColorHex = "blue";

        var result = new CreateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.ColorHex)
            .WithErrorMessage("ColorHex must be a 6-digit hex color, e.g. #3b82f6.");
    }

    [Fact]
    public void Validate_ColorHexWithTrailingNewline_Fails()
    {
        var request = ValidRequest();
        request.ColorHex = "#3b82f6\n";

        var result = new CreateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.ColorHex);
    }

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var result = new CreateFoodTagValidator().TestValidate(ValidRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.Name);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
        result.ShouldNotHaveValidationErrorFor(x => x.ColorHex);
    }
}
