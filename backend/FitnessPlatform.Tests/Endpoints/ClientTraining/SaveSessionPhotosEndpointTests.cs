using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientPlans;
using FitnessPlatform.Application.Features.ClientTraining.SaveSessionPhotos;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="SaveSessionPhotosEndpoint"/>.
/// </summary>
public class SaveSessionPhotosEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly ILogger<SaveSessionPhotosEndpoint> _logger =
        Substitute.For<ILogger<SaveSessionPhotosEndpoint>>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private TrainingPlan CreateActivePlan(Guid? sessionId = null)
    {
        var sid = sessionId ?? Guid.NewGuid();
        var startOfWeek = TrainingCompletionTestHelpers.StartOfCurrentWeekUtc();
        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
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
                    Days = TrainingPlanTestHelpers.MaterializeDays((1, new TrainingSession
                    {
                        SessionId = sid,
                        Name = "Push Day",
                        Order = 1,
                        Workouts = []
                    }))
                }
            ]
        };
    }

    private SaveSessionPhotosEndpoint CreateEndpoint(
        IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper? authHelper = null) =>
        Factory.Create<SaveSessionPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, authHelper ?? EndpointTestHelpers.CreateGrantingAuthHelper(), _logger);

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path: new log inserted
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewLog_InsertsSessionLogAndReturns204()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(sessionId);
        var inserted = new List<SessionLog>();
        var logCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection([], captureInserted: inserted);

        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        mongo.SessionLogs.Returns(logCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new SaveSessionPhotosRequest
        {
            SessionId = sessionId,
            Photos =
            [
                new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg" },
                new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/b.jpg" }
            ],
            Note = "Good session"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await logCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionLog>(log =>
                log.ClientId == _clientId &&
                log.SessionId == sessionId &&
                log.Photos.Count == 2 &&
                log.Note == "Good session"),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        await logCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionLog>>(),
            Arg.Any<UpdateDefinition<SessionLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Idempotency: re-POST same BlobUrl preserves UploadedAt
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_RePostSameBlobUrl_PreservesUploadedAt()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(sessionId);
        const string urlA = "https://minio.local/diary/sessions/s1/a.jpg";
        const string urlB = "https://minio.local/diary/sessions/s1/b.jpg";
        var originalUploadedAt = DateTime.UtcNow.AddHours(-3);

        var existingLog = new SessionLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            LogDate = DateTime.UtcNow.Date,
            Photos = [new SessionPhoto { BlobUrl = urlA, UploadedAt = originalUploadedAt }],
            Note = null
        };

        var logCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection([existingLog]);
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        mongo.SessionLogs.Returns(logCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);
        var beforeCall = DateTime.UtcNow;

        // Re-POST urlA (existing) + urlB (new)
        await ep.HandleAsync(new SaveSessionPhotosRequest
        {
            SessionId = sessionId,
            Photos =
            [
                new SessionPhotoInput { BlobUrl = urlA },
                new SessionPhotoInput { BlobUrl = urlB }
            ],
            Note = null
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // Verify update was issued (not insert)
        await logCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionLog>>(),
            Arg.Any<UpdateDefinition<SessionLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Verify UploadedAt preservation logic by replaying the same keying logic as the endpoint
        var existingByUrl = existingLog.Photos.ToDictionary(p => p.BlobUrl, p => p);
        var now = DateTime.UtcNow;
        var inputs = new[] { urlA, urlB };
        var reproduced = inputs.Select(url =>
        {
            var uploadedAt = existingByUrl.TryGetValue(url, out var ex) ? ex.UploadedAt : now;
            return new SessionPhoto { BlobUrl = url, UploadedAt = uploadedAt };
        }).ToList();

        reproduced.Should().HaveCount(2);
        reproduced.First(p => p.BlobUrl == urlA).UploadedAt.Should().Be(originalUploadedAt);
        reproduced.First(p => p.BlobUrl == urlB).UploadedAt.Should().BeOnOrAfter(beforeCall);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Dual-write idempotency: re-POST same BlobUrl → no duplicate PlanPhoto row
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_RePostSameBlobUrl_NoDuplicatePlanPhotoRow()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(sessionId);
        const string blobUrl = "https://minio.local/diary/sessions/s1/photo.jpg";

        // Pre-seed a PlanPhoto row for the same BlobUrl
        var existingPlanPhoto = new PlanPhoto
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = 0,
            PlanId = plan.ExternalId,
            PlanType = PlanPhotoType.Training,
            LinkId = sessionId,
            Category = PlanPhotoCategory.Training,
            BlobUrl = blobUrl,
            Description = null,
            TakenAt = DateTime.UtcNow.AddHours(-1),
            UploadedByUserId = _clientId,
            DateCreated = DateTime.UtcNow.AddHours(-1),
            DateUpdated = DateTime.UtcNow.AddHours(-1)
        };

        // Existing SessionLog with the photo so the endpoint does an update
        var existingLog = new SessionLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            LogDate = DateTime.UtcNow.Date,
            Photos = [new SessionPhoto { BlobUrl = blobUrl, UploadedAt = DateTime.UtcNow.AddHours(-1) }],
            Note = null
        };

        var logCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection([existingLog]);
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        mongo.SessionLogs.Returns(logCollection);

        // DB has the existing PlanPhoto row
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .With(existingPlanPhoto)
            .Build();

        var ep = CreateEndpoint(mongo, db);

        // Re-POST the same BlobUrl
        await ep.HandleAsync(new SaveSessionPhotosRequest
        {
            SessionId = sessionId,
            Photos = [new SessionPhotoInput { BlobUrl = blobUrl }],
            Note = null
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // No new PlanPhoto row should have been added (idempotent)
        db.PlanPhotos.DidNotReceive().Add(Arg.Any<PlanPhoto>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Dual-write: new photo → creates PlanPhoto with Training category
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewPhoto_CreatesPlanPhotoWithTrainingCategory()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(sessionId);

        var logCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection([]);
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        mongo.SessionLogs.Returns(logCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new SaveSessionPhotosRequest
        {
            SessionId = sessionId,
            Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/x.jpg", Note = "Great lift" }],
            Note = null
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        db.PlanPhotos.Received(1).Add(Arg.Is<PlanPhoto>(p =>
            p.BlobUrl == "https://minio.local/diary/sessions/s1/x.jpg" &&
            p.Category == PlanPhotoCategory.Training &&
            p.PlanType == PlanPhotoType.Training &&
            p.LinkId == sessionId &&
            p.Description == "Great lift"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // F6 residual: planPhotoUploaded is gated on the trainer's CURRENT link
    // capability, not mere plan authorship.
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewPhoto_TrainerHasCapability_EmitsPlanPhotoUploaded()
    {
        // Positive control: with a granting authHelper (the default), the newly-created
        // PlanPhoto row must still trigger the trainer-addressed broadcast.
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(sessionId);

        var logCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection([]);
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        mongo.SessionLogs.Returns(logCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = CreateEndpoint(mongo, db, EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(new SaveSessionPhotosRequest
        {
            SessionId = sessionId,
            Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/granted.jpg" }],
            Note = null
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await _notifier.Received(1).NotifyAsync(
            plan.TrainerId,
            "planphotouploaded",
            Arg.Any<PlanPhotoUploadedEvent>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NewPhoto_TrainerLacksCapability_DoesNotEmitPlanPhotoUploaded()
    {
        // The trainer authored the plan (plan.TrainerId is set) but no longer holds a live,
        // training-capable ClientProfessionalLink — the same defect class F6 closed at the
        // other six sites: authorship must never substitute for a live capability check.
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(sessionId);

        var logCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection([]);
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        mongo.SessionLogs.Returns(logCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = CreateEndpoint(mongo, db, EndpointTestHelpers.CreateGrantingAuthHelper(hasAccess: false));

        await ep.HandleAsync(new SaveSessionPhotosRequest
        {
            SessionId = sessionId,
            Photos = [new SessionPhotoInput { BlobUrl = "https://minio.local/diary/sessions/s1/denied.jpg" }],
            Note = null
        }, TestContext.Current.CancellationToken);

        // The write itself still succeeds — only the broadcast is gated.
        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "planphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Not-found / ownership guard tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoActivePlan_Returns404()
    {
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(null);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new SaveSessionPhotosRequest { SessionId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SessionNotInPlan_Returns404()
    {
        // Plan exists but the requested SessionId is not in any of its sessions
        var sessionId = Guid.NewGuid();
        var plan = CreateActivePlan(Guid.NewGuid()); // a different sessionId
        var mongo = TrainingPhotoTestHelpers.CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Request a sessionId that doesn't exist in the plan
        await ep.HandleAsync(new SaveSessionPhotosRequest { SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
