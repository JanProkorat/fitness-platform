using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientNutrition.GenerateMealPhotoUploadUrl;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="GenerateMealPhotoUploadUrlValidator"/>.
/// </summary>
public class GenerateMealPhotoUploadUrlValidatorTests
{
    private readonly GenerateMealPhotoUploadUrlValidator _validator = new();

    private static GenerateMealPhotoUploadUrlRequest ValidRequest() => new()
    {
        MealId = Guid.NewGuid(),
        ContentType = "image/jpeg",
        SizeBytes = 1024
    };

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path
    // ──────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    [InlineData("image/heic")]
    [InlineData("IMAGE/JPEG")]   // case-insensitive
    public void ValidRequest_AllowedContentTypes_PassesValidation(string contentType)
    {
        var req = ValidRequest();
        req.ContentType = contentType;

        _validator.TestValidate(req).IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_MaxSize_PassesValidation()
    {
        var req = ValidRequest();
        req.SizeBytes = GenerateMealPhotoUploadUrlValidator.MaxSizeBytes;

        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.SizeBytes);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ContentType validation
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void ContentType_Empty_FailsWithRequired()
    {
        var req = ValidRequest();
        req.ContentType = string.Empty;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ContentType)
            .WithErrorCode(ErrorCodes.Required);
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("image/gif")]
    [InlineData("video/mp4")]
    [InlineData("text/plain")]
    public void ContentType_Disallowed_FailsWithInvalidImageContentType(string contentType)
    {
        var req = ValidRequest();
        req.ContentType = contentType;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.ContentType)
            .WithErrorCode(ErrorCodes.InvalidImageContentType);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SizeBytes validation
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void SizeBytes_Zero_FailsWithOutOfRange()
    {
        var req = ValidRequest();
        req.SizeBytes = 0;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.SizeBytes)
            .WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void SizeBytes_Negative_FailsWithOutOfRange()
    {
        var req = ValidRequest();
        req.SizeBytes = -1;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.SizeBytes)
            .WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void SizeBytes_ExceedsMaximum_FailsWithImageTooLarge()
    {
        var req = ValidRequest();
        req.SizeBytes = GenerateMealPhotoUploadUrlValidator.MaxSizeBytes + 1;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.SizeBytes)
            .WithErrorCode(ErrorCodes.ImageTooLarge);
    }

    [Fact]
    public void SizeBytes_One_PassesValidation()
    {
        var req = ValidRequest();
        req.SizeBytes = 1;

        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.SizeBytes);
    }
}
