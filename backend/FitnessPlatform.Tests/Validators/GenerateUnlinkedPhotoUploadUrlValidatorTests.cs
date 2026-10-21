using FitnessPlatform.Application.Features.ClientPhotos.GenerateUnlinkedPhotoUploadUrl;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="GenerateUnlinkedPhotoUploadUrlValidator"/>.
/// </summary>
public class GenerateUnlinkedPhotoUploadUrlValidatorTests
{
    private readonly GenerateUnlinkedPhotoUploadUrlValidator _validator = new();

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    [InlineData("image/heic")]
    [InlineData("image/heif")]
    public void Validate_AllowedContentType_Passes(string contentType)
    {
        var result = _validator.TestValidate(new GenerateUnlinkedPhotoUploadUrlRequest
        {
            ContentType = contentType,
            SizeBytes = 1024
        });

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("image/gif")]
    [InlineData("application/pdf")]
    public void Validate_DisallowedContentType_Fails(string contentType)
    {
        var result = _validator.TestValidate(new GenerateUnlinkedPhotoUploadUrlRequest
        {
            ContentType = contentType,
            SizeBytes = 1024
        });

        result.ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(5L * 1024 * 1024 + 1)]
    public void Validate_SizeOutOfRange_Fails(long sizeBytes)
    {
        var result = _validator.TestValidate(new GenerateUnlinkedPhotoUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = sizeBytes
        });

        result.ShouldHaveValidationErrorFor(x => x.SizeBytes);
    }

    [Fact]
    public void Validate_SizeAtLimit_Passes()
    {
        var result = _validator.TestValidate(new GenerateUnlinkedPhotoUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 5L * 1024 * 1024
        });

        result.IsValid.Should().BeTrue();
    }
}
