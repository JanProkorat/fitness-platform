using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.UpdateFoodTag;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="UpdateFoodTagValidator"/>.
/// </summary>
public class UpdateFoodTagValidatorTests
{
    private static UpdateFoodTagRequest ValidRequest() => new()
    {
        TagId = Guid.NewGuid(),
        Name = "High Protein",
        Description = "Protein-forward foods",
        ColorHex = "#3b82f6",
    };

    [Fact]
    public void Validate_EmptyTagId_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.TagId = Guid.Empty;

        var result = new UpdateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagId).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_EmptyName_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.Name = "";

        var result = new UpdateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_NameOverMaxLength_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.Name = new string('a', 51);

        var result = new UpdateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_DescriptionOverMaxLength_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.Description = new string('a', 501);

        var result = new UpdateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Description).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_ColorHexNotSixDigitHex_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.ColorHex = "not-a-color";

        var result = new UpdateFoodTagValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.ColorHex)
            .WithErrorMessage("ColorHex must be a 6-digit hex color, e.g. #3b82f6.");
    }

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var result = new UpdateFoodTagValidator().TestValidate(ValidRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.TagId);
        result.ShouldNotHaveValidationErrorFor(x => x.Name);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
        result.ShouldNotHaveValidationErrorFor(x => x.ColorHex);
    }
}
