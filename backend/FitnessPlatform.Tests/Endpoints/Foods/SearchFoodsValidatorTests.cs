using FluentValidation.TestHelper;
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
    public void Validate_MoreThanTwentyTags_FailsWithCorrectMessage()
    {
        var request = new SearchFoodsRequest
        {
            Tags = Enumerable.Range(0, 21).Select(i => $"tag-{i}").ToList()
        };

        var result = new SearchFoodsValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Tags)
            .WithErrorMessage("At most 20 tags may be supplied.");
    }

    [Fact]
    public void Validate_DefaultRequest_Passes()
    {
        var result = new SearchFoodsValidator().TestValidate(new SearchFoodsRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.Page);
        result.ShouldNotHaveValidationErrorFor(x => x.PageSize);
        result.ShouldNotHaveValidationErrorFor(x => x.Tags);
    }
}
