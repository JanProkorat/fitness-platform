using FastEndpoints;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Messaging.GenerateChatImageUploadUrl;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Unit tests for <see cref="GenerateChatImageUploadUrlValidator"/>.
/// </summary>
public class GenerateChatImageUploadUrlValidatorTests
{
    private static GenerateChatImageUploadUrlRequest ValidRequest() => new()
    {
        ConversationId = Guid.NewGuid(),
        ContentType = "image/jpeg",
        SizeBytes = 1024,
    };

    [Fact]
    public void Validate_ValidJpegRequest_Passes()
    {
        var result = new GenerateChatImageUploadUrlValidator().TestValidate(ValidRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.ContentType);
        result.ShouldNotHaveValidationErrorFor(x => x.SizeBytes);
    }

    [Theory]
    [InlineData("image/png")]
    [InlineData("image/webp")]
    public void Validate_OtherAllowedContentTypes_Pass(string contentType)
    {
        var request = ValidRequest();
        request.ContentType = contentType;

        var result = new GenerateChatImageUploadUrlValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.ContentType);
    }

    [Theory]
    [InlineData("image/heic")]
    [InlineData("image/heif")]
    [InlineData("image/svg+xml")]
    [InlineData("text/html")]
    [InlineData("")]
    public void Validate_DisallowedContentType_FailsWithInvalidImageContentType(string contentType)
    {
        // heic/heif are accepted by the shared ImageUploadService but must be rejected HERE —
        // chat images are jpeg/png/webp only, since browsers cannot render heic/heif inline.
        var request = ValidRequest();
        request.ContentType = contentType;

        var result = new GenerateChatImageUploadUrlValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.ContentType)
            .WithErrorCode(ErrorCodes.InvalidImageContentType);
    }

    [Fact]
    public void Validate_ZeroSize_FailsWithImageTooLarge()
    {
        var request = ValidRequest();
        request.SizeBytes = 0;

        var result = new GenerateChatImageUploadUrlValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.SizeBytes)
            .WithErrorCode(ErrorCodes.ImageTooLarge);
    }

    [Fact]
    public void Validate_NegativeSize_FailsWithImageTooLarge()
    {
        var request = ValidRequest();
        request.SizeBytes = -1;

        var result = new GenerateChatImageUploadUrlValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.SizeBytes)
            .WithErrorCode(ErrorCodes.ImageTooLarge);
    }

    [Fact]
    public void Validate_SizeAboveCap_FailsWithImageTooLarge()
    {
        var request = ValidRequest();
        request.SizeBytes = ImageUploadService.MaxImageSizeBytes + 1;

        var result = new GenerateChatImageUploadUrlValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.SizeBytes)
            .WithErrorCode(ErrorCodes.ImageTooLarge);
    }

    [Fact]
    public void Validate_SizeExactlyAtCap_Passes()
    {
        var request = ValidRequest();
        request.SizeBytes = ImageUploadService.MaxImageSizeBytes;

        var result = new GenerateChatImageUploadUrlValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.SizeBytes);
    }
}
