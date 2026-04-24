using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.ClientNutrition.SaveMealPhotos;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="SaveMealPhotosValidator"/>.
/// </summary>
public class SaveMealPhotosValidatorTests
{
    private readonly SaveMealPhotosValidator _validator = new();

    private static SaveMealPhotosRequest ValidRequest() => new()
    {
        MealId = Guid.NewGuid(),
        PhotoBlobUrls = []
    };

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void ValidRequest_EmptyPhotoList_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_WithPhotosAndNote_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["https://minio.local/bucket/photo1.jpg"];
        req.Note = "Tasty lunch!";

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Note boundary tests (500 / 501 character boundary)
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Note_ExactlyFiveHundredChars_PassesValidation()
    {
        var req = ValidRequest();
        req.Note = new string('a', 500);

        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Note);
    }

    [Fact]
    public void Note_FiveHundredAndOneChars_FailsValidation()
    {
        var req = ValidRequest();
        req.Note = new string('a', 501);

        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Note);
    }

    [Fact]
    public void Note_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.Note = null;

        _validator.TestValidate(req).ShouldNotHaveValidationErrorFor(x => x.Note);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PhotoBlobUrls URL format tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void PhotoBlobUrls_EmptyString_FailsValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = [string.Empty];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void PhotoBlobUrls_NonHttpUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["ftp://some-server/photo.jpg"];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void PhotoBlobUrls_ValidHttpsUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["https://minio.local/bucket/photo.jpg"];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void PhotoBlobUrls_ValidHttpUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = ["http://minio.local/bucket/photo.jpg"];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void PhotoBlobUrls_EmptyList_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls = [];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void PhotoBlobUrls_MultipleValidUrls_PassesValidation()
    {
        var req = ValidRequest();
        req.PhotoBlobUrls =
        [
            "https://minio.local/bucket/photo1.jpg",
            "https://minio.local/bucket/photo2.jpg"
        ];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }
}
