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
        Photos = []
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
        req.Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo1.jpg" }];
        req.Note = "Tasty lunch!";

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_WithPerPhotoNote_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo1.jpg", Note = "Side of guac added" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Meal-level Note boundary tests (500 / 501 character boundary)
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
    // Per-photo Note boundary tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void PerPhotoNote_ExactlyFiveHundredChars_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos =
        [
            new MealPhotoInput
            {
                BlobUrl = "https://minio.local/bucket/photo1.jpg",
                Note = new string('x', 500)
            }
        ];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void PerPhotoNote_FiveHundredAndOneChars_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos =
        [
            new MealPhotoInput
            {
                BlobUrl = "https://minio.local/bucket/photo1.jpg",
                Note = new string('x', 501)
            }
        ];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void PerPhotoNote_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos =
        [
            new MealPhotoInput
            {
                BlobUrl = "https://minio.local/bucket/photo1.jpg",
                Note = null
            }
        ];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Photos[i].BlobUrl URL format tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Photos_EmptyBlobUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos = [new MealPhotoInput { BlobUrl = string.Empty }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Photos_NonHttpUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos = [new MealPhotoInput { BlobUrl = "ftp://some-server/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Photos_ValidHttpsUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Photos_ValidHttpUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new MealPhotoInput { BlobUrl = "http://minio.local/bucket/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Photos_EmptyList_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Photos_MultipleValidUrls_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos =
        [
            new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo1.jpg" },
            new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo2.jpg" }
        ];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }
}
