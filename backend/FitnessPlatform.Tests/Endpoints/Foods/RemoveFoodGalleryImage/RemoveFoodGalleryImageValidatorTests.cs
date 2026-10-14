using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.RemoveFoodGalleryImage;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Foods.RemoveFoodGalleryImage;

/// <summary>
/// Tests for <see cref="RemoveFoodGalleryImageValidator"/>.
/// </summary>
public class RemoveFoodGalleryImageValidatorTests
{
    [Fact]
    public void Validate_ValidUrl_Passes()
    {
        new RemoveFoodGalleryImageValidator()
            .TestValidate(new RemoveFoodGalleryImageRequest { FoodId = Guid.NewGuid(), ImageUrl = "foods/a/gallery-b.jpg" })
            .IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Validate_EmptyUrl_FailsWithRequired(string? url)
    {
        var result = new RemoveFoodGalleryImageValidator()
            .TestValidate(new RemoveFoodGalleryImageRequest { ImageUrl = url! });

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.Required);
    }

    [Fact]
    public void Validate_UrlOver2048_FailsWithOutOfRange()
    {
        var result = new RemoveFoodGalleryImageValidator()
            .TestValidate(new RemoveFoodGalleryImageRequest { ImageUrl = "https://x/" + new string('a', 2040) });

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }
}
