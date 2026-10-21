using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPhotos.FinalizeUnlinkedPhoto;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="FinalizeUnlinkedPhotoValidator"/>.
/// </summary>
public class FinalizeUnlinkedPhotoValidatorTests
{
    private readonly FinalizeUnlinkedPhotoValidator _validator = new();

    private static FinalizeUnlinkedPhotoRequest Valid() => new()
    {
        BlobUrl = $"plan-photos/unlinked/{Guid.NewGuid()}/{Guid.NewGuid()}.jpg",
        Category = PlanPhotoCategory.Body
    };

    [Theory]
    [InlineData(PlanPhotoCategory.Body)]
    [InlineData(PlanPhotoCategory.FreeForm)]
    public void Validate_BodyOrFreeFormCategory_Passes(PlanPhotoCategory category)
    {
        var request = Valid();
        request.Category = category;

        _validator.TestValidate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(PlanPhotoCategory.Food)]
    [InlineData(PlanPhotoCategory.Training)]
    public void Validate_FoodOrTrainingCategory_Fails(PlanPhotoCategory category)
    {
        var request = Valid();
        request.Category = category;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Category);
    }

    [Theory]
    [InlineData("")]
    [InlineData("plan-photos/unlinked/user/not-a-uuid.jpg")]
    [InlineData("plan-photos/unlinked/user/3f2504e0-4f89-11d3-9a0c-0305e82c3301.gif")]
    [InlineData("plan-photos/unlinked/user/../3f2504e0-4f89-11d3-9a0c-0305e82c3301.jpg")]
    public void Validate_BadBlobUrl_FailsWithInvalidBlobUrlCode(string blobUrl)
    {
        var request = Valid();
        request.BlobUrl = blobUrl;

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.BlobUrl);
        if (blobUrl.Length > 0)
        {
            result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.InvalidBlobUrl);
        }
    }

    [Fact]
    public void Validate_SignedUrlWithQueryString_Passes()
    {
        var request = Valid();
        request.BlobUrl = $"https://host/bucket/plan-photos/unlinked/{Guid.NewGuid()}/{Guid.NewGuid()}.png?X-Amz-Signature=abc";

        _validator.TestValidate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_DescriptionOver500Chars_Fails()
    {
        var request = Valid();
        request.Description = new string('a', 501);

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Description);
    }
}
