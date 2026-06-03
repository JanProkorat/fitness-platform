using FluentAssertions;
using FluentValidation;
using FitnessPlatform.Application.Features.ClientTraining.SaveSessionPhotos;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="SaveSessionPhotosValidator"/>.
/// </summary>
public class SaveSessionPhotosValidatorTests
{
    private readonly SaveSessionPhotosValidator _validator = new();

    [Fact]
    public async Task Validate_ValidRequest_IsValid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg" }],
            Note = "Good session"
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_EmptyPhotoList_IsValid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [],
            Note = null
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_NoteTooLong_IsInvalid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [],
            Note = new string('x', 501)
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("Note"));
    }

    [Fact]
    public async Task Validate_EmptyBlobUrl_IsInvalid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [new SessionPhotoInput { BlobUrl = "" }],
            Note = null
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Validate_NonHttpBlobUrl_IsInvalid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [new SessionPhotoInput { BlobUrl = "ftp://bad-url.com/photo.jpg" }],
            Note = null
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Validate_PerPhotoNoteTooLong_IsInvalid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [new SessionPhotoInput
            {
                BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg",
                Note = new string('x', 501)
            }],
            Note = null
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Validate_PerPhotoNoteMaxLength_IsValid()
    {
        var req = new SaveSessionPhotosRequest
        {
            SessionId = Guid.NewGuid(),
            Photos = [new SessionPhotoInput
            {
                BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg",
                Note = new string('x', 500)
            }],
            Note = null
        };

        var result = await _validator.ValidateAsync(req, TestContext.Current.CancellationToken);
        result.IsValid.Should().BeTrue();
    }
}
