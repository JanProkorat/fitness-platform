using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.ClientTraining.SaveSessionPhotos;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="SaveSessionPhotosValidator"/>.
/// </summary>
public class SaveSessionPhotosValidatorTests
{
    private readonly SaveSessionPhotosValidator _validator = new();

    private static SaveSessionPhotosRequest ValidRequest() => new()
    {
        SessionId = Guid.NewGuid(),
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
        req.Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg" }];
        req.Note = "Good session";

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidRequest_WithPerPhotoNote_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg", Note = "Great form" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Session-level Note boundary tests (500 / 501 character boundary)
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
            new SessionPhotoInput
            {
                BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg",
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
            new SessionPhotoInput
            {
                BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg",
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
            new SessionPhotoInput
            {
                BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg",
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
        req.Photos = [new SessionPhotoInput { BlobUrl = string.Empty }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Photos_NonHttpUrl_FailsValidation()
    {
        var req = ValidRequest();
        req.Photos = [new SessionPhotoInput { BlobUrl = "ftp://some-server/photo.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Photos_ValidHttpsUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg" }];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Photos_ValidHttpUrl_PassesValidation()
    {
        var req = ValidRequest();
        req.Photos = [new SessionPhotoInput { BlobUrl = "http://minio.local/diary/sessions/s1/a.jpg" }];

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
            new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg" },
            new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/b.jpg" }
        ];

        var result = _validator.TestValidate(req);
        result.IsValid.Should().BeTrue();
    }
}
