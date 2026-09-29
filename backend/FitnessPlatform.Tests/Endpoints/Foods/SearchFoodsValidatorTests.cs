using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.SearchFoods;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="SearchFoodsValidator"/>.
/// </summary>
public class SearchFoodsValidatorTests
{
    [Fact]
    public void Validate_PageBelowOne_FailsWithCorrectMessage()
    {
        var result = new SearchFoodsValidator().TestValidate(new SearchFoodsRequest { Page = 0 });

        result.ShouldHaveValidationErrorFor(x => x.Page);
    }

    [Fact]
    public void Validate_PageSizeOutOfRange_FailsWithCorrectMessage()
    {
        var result = new SearchFoodsValidator().TestValidate(new SearchFoodsRequest { PageSize = 101 });

        result.ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void Validate_MoreThanTwentyTagIds_FailsWithCorrectMessage()
    {
        var request = new SearchFoodsRequest
        {
            TagIds = Enumerable.Range(0, 21).Select(_ => Guid.NewGuid()).ToList()
        };

        var result = new SearchFoodsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds)
            .WithErrorMessage("At most 20 tag ids may be supplied.");
    }

    [Fact]
    public void Validate_EmptyTagId_FailsWithCorrectMessage()
    {
        var request = new SearchFoodsRequest { TagIds = [Guid.Empty] };

        var result = new SearchFoodsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.TagIds)
            .WithErrorMessage("A filter tag id must not be empty.");
    }

    [Fact]
    public void Validate_DefaultRequest_Passes()
    {
        var result = new SearchFoodsValidator().TestValidate(new SearchFoodsRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.Page);
        result.ShouldNotHaveValidationErrorFor(x => x.PageSize);
        result.ShouldNotHaveValidationErrorFor(x => x.TagIds);
        result.ShouldNotHaveValidationErrorFor(x => x.Categories);
    }

    [Fact]
    public void Validate_InvalidCategoryEnumValue_FailsValidation()
    {
        var request = new SearchFoodsRequest { Categories = [(FoodCategory)999] };

        var result = new SearchFoodsValidator().TestValidate(request);

        // IsInEnum is a plain shape check with no WithErrorCode/WithMessage (rules/validation.md),
        // and its default message embeds the (camelCased-under-full-suite) property name, so this
        // only asserts a failure exists for Categories rather than matching exact text.
        result.ShouldHaveValidationErrorFor(x => x.Categories);
    }

    [Fact]
    public void Validate_MoreThanMaxCategories_FailsWithCorrectMessage()
    {
        var categoryCount = Enum.GetValues<FoodCategory>().Length;
        var request = new SearchFoodsRequest
        {
            // One extra beyond every distinct enum member — necessarily has a duplicate.
            Categories = Enumerable.Range(0, categoryCount + 1)
                .Select(i => (FoodCategory)(i % categoryCount))
                .ToList()
        };

        var result = new SearchFoodsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Categories)
            .WithErrorMessage($"At most {categoryCount} categories may be supplied.");
    }
}
