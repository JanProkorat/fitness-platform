using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Recipes.ReplaceRecipeTagAssignments;
using FitnessPlatform.Application.Features.Recipes.SearchRecipes;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Unit tests for <see cref="ReplaceRecipeTagAssignmentsValidator"/> and the <c>tagId</c> rules of
/// <see cref="SearchRecipesValidator"/>.
/// </summary>
public class ReplaceRecipeTagAssignmentsValidatorTests
{
    private static ReplaceRecipeTagAssignmentsRequest ValidRequest() => new()
    {
        RecipeId = Guid.NewGuid(),
        TagIds = [Guid.NewGuid(), Guid.NewGuid()],
    };

    [Fact]
    public void Validate_EmptyRecipeId_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.RecipeId = Guid.Empty;

        var result = new ReplaceRecipeTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.RecipeId).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_NullTagIds_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.TagIds = null!;

        var result = new ReplaceRecipeTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Validate_MoreThanFiftyTagIds_FailsWithCorrectErrorCode()
    {
        var request = ValidRequest();
        request.TagIds = Enumerable.Range(0, 51).Select(_ => Guid.NewGuid()).ToList();

        var result = new ReplaceRecipeTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_DuplicateTagIds_FailsWithCorrectMessage()
    {
        var duplicateId = Guid.NewGuid();
        var request = ValidRequest();
        request.TagIds = [duplicateId, duplicateId];

        var result = new ReplaceRecipeTagAssignmentsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds)
            .WithErrorMessage("TagIds must not contain duplicates.");
    }

    [Fact]
    public void Validate_EmptyTagIds_Passes()
    {
        var request = ValidRequest();
        request.TagIds = [];

        var result = new ReplaceRecipeTagAssignmentsValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }

    [Fact]
    public void Search_MoreThanTwentyTagIds_FailsWithCorrectMessage()
    {
        var request = new SearchRecipesRequest
        {
            TagIds = Enumerable.Range(0, 21).Select(_ => Guid.NewGuid()).ToList(),
        };

        var result = new SearchRecipesValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds)
            .WithErrorMessage("At most 20 tag ids may be supplied.");
    }

    [Fact]
    public void Search_EmptyGuidTagId_FailsWithCorrectMessage()
    {
        var request = new SearchRecipesRequest { TagIds = [Guid.Empty] };

        var result = new SearchRecipesValidator().TestValidate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage == "A filter tag id must not be empty.");
    }

    [Fact]
    public void Search_TwentyTagIds_Passes()
    {
        var request = new SearchRecipesRequest
        {
            TagIds = Enumerable.Range(0, 20).Select(_ => Guid.NewGuid()).ToList(),
        };

        var result = new SearchRecipesValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
    }
}
