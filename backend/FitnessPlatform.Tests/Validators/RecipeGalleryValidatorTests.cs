using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Recipes.PromoteRecipeGalleryImage;
using FitnessPlatform.Application.Features.Recipes.RemoveRecipeGalleryImage;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="RemoveRecipeGalleryImageValidator"/> and <see cref="PromoteRecipeGalleryImageValidator"/>.
/// </summary>
public class RecipeGalleryValidatorTests
{
    private static readonly string TooLong = "https://x/" + new string('a', 2040);

    [Fact]
    public void Remove_ValidUrl_Passes()
    {
        new RemoveRecipeGalleryImageValidator()
            .TestValidate(new RemoveRecipeGalleryImageRequest { RecipeId = Guid.NewGuid(), ImageUrl = "recipes/a/gallery-b.jpg" })
            .IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("", ErrorCodes.Required)]
    [InlineData(null, ErrorCodes.Required)]
    public void Remove_EmptyUrl_Fails(string? url, string errorCode)
    {
        var result = new RemoveRecipeGalleryImageValidator()
            .TestValidate(new RemoveRecipeGalleryImageRequest { ImageUrl = url! });

        result.Errors.Should().Contain(e => e.ErrorCode == errorCode);
    }

    [Fact]
    public void Remove_UrlOver2048_Fails()
    {
        var result = new RemoveRecipeGalleryImageValidator()
            .TestValidate(new RemoveRecipeGalleryImageRequest { ImageUrl = TooLong });

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Promote_ValidUrl_Passes()
    {
        new PromoteRecipeGalleryImageValidator()
            .TestValidate(new PromoteRecipeGalleryImageRequest { RecipeId = Guid.NewGuid(), ImageUrl = "recipes/a/gallery-b.jpg" })
            .IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("", ErrorCodes.Required)]
    [InlineData(null, ErrorCodes.Required)]
    public void Promote_EmptyUrl_Fails(string? url, string errorCode)
    {
        var result = new PromoteRecipeGalleryImageValidator()
            .TestValidate(new PromoteRecipeGalleryImageRequest { ImageUrl = url! });

        result.Errors.Should().Contain(e => e.ErrorCode == errorCode);
    }

    [Fact]
    public void Promote_UrlOver2048_Fails()
    {
        var result = new PromoteRecipeGalleryImageValidator()
            .TestValidate(new PromoteRecipeGalleryImageRequest { ImageUrl = TooLong });

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }
}
