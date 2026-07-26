using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.GenerateSessionPhotoUploadUrl;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="GenerateSessionPhotoUploadUrlEndpoint"/>.
/// </summary>
public class GenerateSessionPhotoUploadUrlEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private GenerateSessionPhotoUploadUrlEndpoint CreateEndpoint(
        IMongoContext mongo,
        IApplicationDbContext db,
        Guid? callerUserId = null) =>
        Factory.Create<GenerateSessionPhotoUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(callerUserId ?? _clientId, AppRoles.Client))),
            _imageUpload, mongo, db);

    private static IMongoContext CreateMongoWithActivePlan(Guid clientId, Guid? sessionId = null, bool addSession = true)
    {
        var sid = sessionId ?? Guid.NewGuid();
        var startOfWeek = TrainingCompletionTestHelpers.StartOfCurrentWeekUtc();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startOfWeek,
                    Sessions = addSession
                        ?
                        [
                            new TrainingSession
                            {
                                SessionId = sid,
                                DayOfWeek = 1,
                                Name = "Push Day",
                                Order = 1,
                                Sections = []
                            }
                        ]
                        : []
                }
            ]
        };

        return TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsUploadUrlWithSessionPrefix()
    {
        var sessionId = Guid.NewGuid();
        var mongo = CreateMongoWithActivePlan(_clientId, sessionId, addSession: true);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Diary,
                Arg.Is<string>(s => s.StartsWith($"sessions/{sessionId}/") && s.EndsWith(".jpg")),
                "image/jpeg",
                2048,
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload?token=abc",
                $"diary/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateSessionPhotoUploadUrlRequest
        {
            SessionId = sessionId,
            ContentType = "image/jpeg",
            SizeBytes = 2048
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        ep.Response.BlobUrl.Should().StartWith($"diary/sessions/{sessionId}/");
        ep.Response.BlobUrl.Should().EndWith(".jpg");
    }

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    [InlineData("image/heic", "heic")]
    public async Task HandleAsync_AllowedContentTypes_CallServiceWithDiaryScopeAndCorrectExtension(
        string contentType, string expectedExt)
    {
        var sessionId = Guid.NewGuid();
        var mongo = CreateMongoWithActivePlan(_clientId, sessionId, addSession: true);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<long>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload",
                $"diary/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateSessionPhotoUploadUrlRequest
        {
            SessionId = sessionId,
            ContentType = contentType,
            SizeBytes = 512
        }, TestContext.Current.CancellationToken);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Diary,
            Arg.Is<string>(s => s.StartsWith($"sessions/{sessionId}/") && s.EndsWith($".{expectedExt}")),
            contentType,
            512,
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Not-found / ownership tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_SessionNotInPlan_Returns404()
    {
        // Plan exists but has no sessions, so any sessionId will be unknown
        var mongo = CreateMongoWithActivePlan(_clientId, addSession: false);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateSessionPhotoUploadUrlRequest
        {
            SessionId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoActivePlan_Returns404()
    {
        // No active plan for this client
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(null);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateSessionPhotoUploadUrlRequest
        {
            SessionId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoUserClaims_Returns401()
    {
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(null);
        var db = CreateMockDb();

        // Create endpoint with no claims principal (unauthenticated)
        var ep = Factory.Create<GenerateSessionPhotoUploadUrlEndpoint>(_imageUpload, mongo, db);

        await ep.HandleAsync(new GenerateSessionPhotoUploadUrlRequest
        {
            SessionId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Service-level validation errors
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_SizeTooLarge_ServiceThrows_PropagatesException()
    {
        var sessionId = Guid.NewGuid();
        var mongo = CreateMongoWithActivePlan(_clientId, sessionId, addSession: true);
        var db = CreateMockDb();

        const long elevenMb = 11L * 1024 * 1024;

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                "image/jpeg",
                elevenMb,
                Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("sizeBytes", "too large")
                    { ErrorCode = ErrorCodes.ImageTooLarge }],
                "Image too large."));

        var ep = CreateEndpoint(mongo, db);

        var act = () => ep.HandleAsync(new GenerateSessionPhotoUploadUrlRequest
        {
            SessionId = sessionId,
            ContentType = "image/jpeg",
            SizeBytes = elevenMb
        }, TestContext.Current.CancellationToken);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }
}
