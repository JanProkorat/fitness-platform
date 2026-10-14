using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.PromoteFoodGalleryImage;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Foods.PromoteFoodGalleryImage;

/// <summary>
/// Tests for <see cref="PromoteFoodGalleryImageValidator"/>.
/// </summary>
public class PromoteFoodGalleryImageValidatorTests
{
    [Fact]
    public void Validate_ValidUrl_Passes()
    {
        new PromoteFoodGalleryImageValidator()
            .TestValidate(new PromoteFoodGalleryImageRequest { FoodId = Guid.NewGuid(), ImageUrl = "foods/a/gallery-b.jpg" })
            .IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validate_EmptyUrl_FailsWithRequired(string? url)
    {
        var result = new PromoteFoodGalleryImageValidator()
            .TestValidate(new PromoteFoodGalleryImageRequest { ImageUrl = url! });

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.Required);
    }

    [Fact]
    public void Validate_UrlOver2048_FailsWithOutOfRange()
    {
        var result = new PromoteFoodGalleryImageValidator()
            .TestValidate(new PromoteFoodGalleryImageRequest { ImageUrl = "https://x/" + new string('a', 2040) });

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }
}
