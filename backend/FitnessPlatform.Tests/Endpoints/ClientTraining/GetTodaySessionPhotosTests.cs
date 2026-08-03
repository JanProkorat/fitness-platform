using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="GetTodaySessionEndpoint"/> PhotosBySession enrichment path.
/// Separate class to keep test concerns isolated; all other GetTodaySession tests are in
/// <see cref="GetTodaySessionEndpointTests"/>.
/// </summary>
public class GetTodaySessionPhotosTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    /// <summary>
    /// ISO day-of-week (1 = Monday, 7 = Sunday).
    /// </summary>
    private static int TodayDow()
    {
        var dow = (int)DateTime.UtcNow.DayOfWeek;
        return dow == 0 ? 7 : dow;
    }

    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    private IMongoContext CreateMongoWithPlanAndSessionLog(
        Guid sessionId,
        List<SessionLog>? sessionLogs = null)
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();

        var plan = new TrainingPlan
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
                    Days = TrainingPlanTestHelpers.MaterializeDays((todayDow, new TrainingSession
                    {
                        SessionId = sessionId,
                        Name = "Push Day",
                        Order = 1,
                        Workouts = []
                    }))
                }
            ]
        };

        var mongo = Substitute.For<IMongoContext>();

        // Build all collections BEFORE calling .Returns() to avoid NSubstitute nesting issues
        var planCollection = TrainingPhotoTestHelpers.CreateCollection([plan]);
        var exerciseCollection = TrainingPhotoTestHelpers.CreateCollection<Exercise>([]);
        var completionCollection = TrainingPhotoTestHelpers.CreateCollection<TrainingCompletion>([]);
        var workoutLogCollection = TrainingPhotoTestHelpers.CreateCollection<WorkoutLog>([]);
        var sessionLockCollection = TrainingPhotoTestHelpers.CreateCollection<SessionLock>([]);
        var sessionLogCollection = TrainingPhotoTestHelpers.CreateSessionLogCollection(sessionLogs ?? []);

        // Assign after all substitutes are created
        mongo.TrainingPlans.Returns(planCollection);
        mongo.Exercises.Returns(exerciseCollection);
        mongo.TrainingCompletions.Returns(completionCollection);
        mongo.WorkoutLogs.Returns(workoutLogCollection);
        mongo.SessionLocks.Returns(sessionLockCollection);
        mongo.SessionLogs.Returns(sessionLogCollection);

        return mongo;
    }

    private static ISessionLockService CreateStubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new List<SessionLock>() as IReadOnlyList<SessionLock>);
        return svc;
    }

    private GetTodaySessionEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, CreateStubLockService());

    // ──────────────────────────────────────────────────────────────────────────
    // Read-back: photos saved to SessionLog appear in PhotosBySession
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_SessionLogWithPhotos_PopulatesPhotosBySession()
    {
        var sessionId = Guid.NewGuid();
        var uploadedAt = DateTime.UtcNow.AddMinutes(-10);

        var sessionLog = new SessionLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            SessionId = sessionId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new SessionPhoto { BlobUrl = "https://minio.local/diary/sessions/s1/a.jpg", UploadedAt = uploadedAt, Note = "Note A" },
                new SessionPhoto { BlobUrl = "https://minio.local/diary/sessions/s1/b.jpg", UploadedAt = uploadedAt, Note = null }
            ],
            Note = "Good workout"
        };

        var mongo = CreateMongoWithPlanAndSessionLog(sessionId, [sessionLog]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.PhotosBySession.Should().ContainKey(sessionId);
        var photos = ep.Response.PhotosBySession[sessionId];
        photos.Should().HaveCount(2);
        photos[0].BlobUrl.Should().Be("https://minio.local/diary/sessions/s1/a.jpg");
        photos[0].UploadedAt.Should().Be(uploadedAt);
        photos[0].Note.Should().Be("Note A");
        photos[1].BlobUrl.Should().Be("https://minio.local/diary/sessions/s1/b.jpg");
        photos[1].Note.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_NoSessionLog_PhotosBySessionIsEmpty()
    {
        var sessionId = Guid.NewGuid();

        // No session logs at all
        var mongo = CreateMongoWithPlanAndSessionLog(sessionId, []);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.PhotosBySession.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_SessionLogWithNoPhotos_SessionIdNotInPhotosBySession()
    {
        var sessionId = Guid.NewGuid();

        // Session log exists but has zero photos
        var sessionLog = new SessionLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            SessionId = sessionId,
            LogDate = DateTime.UtcNow.Date,
            Photos = [],
            Note = "diary note only"
        };

        var mongo = CreateMongoWithPlanAndSessionLog(sessionId, [sessionLog]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // Zero-photo logs don't occupy a key in PhotosBySession
        ep.Response.PhotosBySession.Should().NotContainKey(sessionId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Read-back: NotesBySession round-trip (data-loss prevention)
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_SessionLogWithPhotosAndNote_PopulatesNotesBySession()
    {
        // Arrange: a session log with both photos and a session-level note.
        // The mobile client must be able to pre-load this note so that saving photos
        // with a blank textarea doesn't overwrite the stored value with null.
        var sessionId = Guid.NewGuid();
        var uploadedAt = DateTime.UtcNow.AddMinutes(-5);

        var sessionLog = new SessionLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            SessionId = sessionId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new SessionPhoto { BlobUrl = "https://minio.local/diary/s1/a.jpg", UploadedAt = uploadedAt }
            ],
            Note = "Felt strong today"
        };

        var mongo = CreateMongoWithPlanAndSessionLog(sessionId, [sessionLog]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // Photos still present
        ep.Response.PhotosBySession.Should().ContainKey(sessionId);
        // Note round-tripped under NotesBySession
        ep.Response.NotesBySession.Should().ContainKey(sessionId);
        ep.Response.NotesBySession[sessionId].Should().Be("Felt strong today");
    }

    [Fact]
    public async Task HandleAsync_SessionLogWithPhotosAndNoNote_NotInNotesBySession()
    {
        // Arrange: a session log with photos but no session-level note.
        // NotesBySession must NOT contain a key for this session — null / empty notes
        // are excluded so the mobile client falls back to an empty textarea cleanly.
        var sessionId = Guid.NewGuid();
        var uploadedAt = DateTime.UtcNow.AddMinutes(-5);

        var sessionLog = new SessionLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            SessionId = sessionId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new SessionPhoto { BlobUrl = "https://minio.local/diary/s1/b.jpg", UploadedAt = uploadedAt }
            ],
            Note = null   // no note
        };

        var mongo = CreateMongoWithPlanAndSessionLog(sessionId, [sessionLog]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.PhotosBySession.Should().ContainKey(sessionId);
        // No entry for sessions without a note
        ep.Response.NotesBySession.Should().NotContainKey(sessionId);
    }
}
