using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.ClientNutrition.SaveDayPhotos;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="SaveDayPhotosValidator"/>.
/// </summary>
public class SaveDayPhotosValidatorTests
{
    private readonly SaveDayPhotosValidator _validator = new();

    private static SaveDayPhotosRequest ValidRequest() => new()
    {
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
        req.Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/plan-photos/p1.jpg", Category = DayPhotoCategory.Progress }];
        req.Note = "Great progress!";

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("Food")]
    [InlineData("Progress")]
    [InlineData("Free")]
    public void Photos_AllValidCategories_PassValidation(string categoryName)
    {
        var category = Enum.Parse<DayPhotoCategory>(categoryName);
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/p.jpg", Category = category }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Day-level Note boundary tests
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
        req.Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/p.jpg", Note = new string('x', 500) }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void PerPhotoNote_FiveHundredAndOneChars_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/p.jpg", Note = new string('x', 501) }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void PerPhotoNote_Null_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/p.jpg", Note = null }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BlobUrl format tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Photos_EmptyBlobUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = string.Empty }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Photos_NonHttpUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = "ftp://some-server/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Photos_ValidHttpsUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/plan-photos/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Photos_ValidHttpUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new DayPhotoInput { BlobUrl = "http://minio.local/plan-photos/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }
}
