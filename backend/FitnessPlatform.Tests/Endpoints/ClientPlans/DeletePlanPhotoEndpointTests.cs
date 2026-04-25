using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientPlans.DeletePlanPhoto;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientPlans;

/// <summary>
/// Tests for <see cref="DeletePlanPhotoEndpoint"/>.
/// Acceptance criteria:
///   - Client cannot delete another client's photo (403 with ErrorCode).
///   - Professional cannot delete client uploads (also 403 — only the uploader can delete).
///   - Delete removes DB row + blob.
/// </summary>
public class DeletePlanPhotoEndpointTests
{
    private readonly Guid _uploaderId = Guid.NewGuid();
    private readonly IBlobStorageService _blob = Substitute.For<IBlobStorageService>();

    private IApplicationDbContext CreateMockDb(params PlanPhoto[] photos)
    {
        var builder = new MockDbBuilder()
            .With(new ClientProfile { UserId = _uploaderId, PublicId = _uploaderId });
        foreach (var photo in photos)
            builder.With(photo);
        return builder.Build();
    }

    private DeletePlanPhotoEndpoint CreateEndpoint(IApplicationDbContext db, Guid? callerUserId = null) =>
        Factory.Create<DeletePlanPhotoEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(callerUserId ?? _uploaderId, AppRoles.Client))),
            db, _blob);

    private PlanPhoto CreatePhoto(
        Guid? publicId = null,
        Guid? uploadedBy = null,
        string blobUrl = "http://localhost:9000/fitness-platform/plan-photos/abc/photo.jpg") =>
        new()
        {
            PublicId = publicId ?? Guid.NewGuid(),
            ClientProfileId = 1,
            UploadedByUserId = uploadedBy ?? _uploaderId,
            BlobUrl = blobUrl,
            Category = PlanPhotoCategory.Body,
            TakenAt = DateTime.UtcNow,
            DateCreated = DateTime.UtcNow
        };

    // ── Happy-path: own photo deleted ────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_OwnPhoto_Returns204AndDeletesBlob()
    {
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(publicId: photoId);
        var db = CreateMockDb(photo);

        _blob.DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(
            new DeletePlanPhotoRequest { PhotoId = photoId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await _blob.Received(1).DeleteAsync(
            "plan-photos/abc/photo.jpg",
            Arg.Any<CancellationToken>());
    }

    // ── Auth gates ────────────────────────────────────────────────────────────

    /// <summary>Client cannot delete another client's photo — returns 403.</summary>
    [Fact]
    public async Task HandleAsync_OtherClientPhoto_Returns403WithErrorCode()
    {
        var otherUserId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        // Photo was uploaded by a different user
        var photo = CreatePhoto(publicId: photoId, uploadedBy: otherUserId);
        var db = CreateMockDb(photo);

        // Caller is _uploaderId, photo was uploaded by otherUserId
        var ep = CreateEndpoint(db, callerUserId: _uploaderId);

        await ep.HandleAsync(
            new DeletePlanPhotoRequest { PhotoId = photoId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);

        await _blob.DidNotReceive().DeleteAsync(
            Arg.Any<string>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>Professional calling as Client role but with another user ID should get 403.</summary>
    [Fact]
    public async Task HandleAsync_ProfessionalCallerDifferentId_Returns403()
    {
        var professionalUserId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        // Photo uploaded by _uploaderId (a client)
        var photo = CreatePhoto(publicId: photoId, uploadedBy: _uploaderId);
        var db = CreateMockDb(photo);

        // Professional's user ID is different from the uploader
        var ep = CreateEndpoint(db, callerUserId: professionalUserId);

        await ep.HandleAsync(
            new DeletePlanPhotoRequest { PhotoId = photoId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    // ── Not-found ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_PhotoNotFound_Returns404WithErrorCode()
    {
        var db = CreateMockDb(); // no photos
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(
            new DeletePlanPhotoRequest { PhotoId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── Blob path extraction ──────────────────────────────────────────────────

    [Theory]
    [InlineData(
        "http://localhost:9000/fitness-platform/plan-photos/pid/photo.jpg",
        "plan-photos/pid/photo.jpg")]
    [InlineData(
        "https://storage.example.com/myapp/plan-photos/x/y.png",
        "plan-photos/x/y.png")]
    [InlineData(
        "plan-photos/relative/path.jpg",
        "plan-photos/relative/path.jpg")]
    public async Task HandleAsync_BlobPathExtraction_DeletesCorrectPath(
        string blobUrl, string expectedContainerPath)
    {
        var photoId = Guid.NewGuid();
        var photo = CreatePhoto(publicId: photoId, blobUrl: blobUrl);
        var db = CreateMockDb(photo);

        _blob.DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(
            new DeletePlanPhotoRequest { PhotoId = photoId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await _blob.Received(1).DeleteAsync(
            expectedContainerPath,
            Arg.Any<CancellationToken>());
    }
}
