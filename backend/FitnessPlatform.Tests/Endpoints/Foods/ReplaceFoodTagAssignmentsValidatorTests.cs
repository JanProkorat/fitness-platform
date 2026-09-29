using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.ReplaceFoodTagAssignments;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="ReplaceFoodTagAssignmentsValidator"/>.
/// </summary>
public class ReplaceFoodTagAssignmentsValidatorTests
{
    private static ReplaceFoodTagAssignmentsRequest ValidRequest() => new()
    {
        FoodId = Guid.NewGuid(),
        TagIds = [Guid.NewGuid(), Guid.NewGuid()],
    };

    [Fact]
    public void Validate_EmptyFoodId_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.FoodId = Guid.Empty;

        var result = new ReplaceFoodTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.FoodId).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_NullTagIds_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.TagIds = null!;

        var result = new ReplaceFoodTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_MoreThanFiftyTagIds_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.TagIds = Enumerable.Range(0, 51).Select(_ => Guid.NewGuid()).ToList();

        var result = new ReplaceFoodTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_DuplicateTagIds_FailsWithCorrectMessage()
    {
        var duplicateId = Guid.NewGuid();
        var request = ValidRequest();
        request.TagIds = [duplicateId, duplicateId];

        var result = new ReplaceFoodTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds)
            .WithErrorMessage("TagIds must not contain duplicates.");
    }

    [Fact]
    public void Validate_EmptyTagIds_Passes()
    {
        var request = ValidRequest();
        request.TagIds = [];

        var result = new ReplaceFoodTagAssignmentsValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var result = new ReplaceFoodTagAssignmentsValidator().TestValidate(ValidRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.FoodId);
        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }
}
