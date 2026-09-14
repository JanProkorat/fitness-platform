using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining;
using FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests that verify the <c>trainingprogressupdated</c> SignalR broadcast
/// behaviour of <see cref="MarkExerciseCompleteEndpoint"/>.
/// One solid suite on this endpoint is sufficient; the broadcaster helper
/// is shared by all five Mark* endpoints.
/// </summary>
public class MarkExerciseCompleteBroadcastTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _sectionId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();

    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ISessionLockService _lockService = CreateStubLockService();
    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });
    private readonly IClientLinkAuthorizationService _linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
    private readonly ILogger<MarkExerciseCompleteEndpoint> _logger =
        Substitute.For<ILogger<MarkExerciseCompleteEndpoint>>();

    private static ISessionLockService CreateStubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.RefreshAsync(Arg.Any<Guid>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>()).Returns(false);
        return svc;
    }

    private IApplicationDbContext CreateMockDb(Guid clientUserId, Guid clientPublicId) =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = clientUserId, PublicId = clientPublicId })
            .Build();

    private TrainingPlan CreateActivePlan(Guid? trainerId = null) =>
        TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            trainerId: trainerId ?? _trainerId,
            sectionId: _sectionId);

    // ── Broadcast is sent once on a successful new completion ────────────

    [Fact]
    public async Task HandleAsync_NewCompletion_BroadcastsExactlyOnce()
    {
        var plan = CreateActivePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Exactly one notification to the trainer's user id
        await _notifier.Received(1).NotifyAsync(
            _trainerId,
            "trainingprogressupdated",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── F6 (claude-security review): revoked/narrowed link stops the broadcast ────
    // TrainingProgressBroadcaster used to read plan.TrainerId unconditionally — authorship is
    // permanent even after the collaboration ends. This proves the shared broadcaster now
    // consults the link's live capability before notifying.

    [Fact]
    public async Task HandleAsync_LinkDeniesTrainingAccess_DoesNotBroadcastToTrainer()
    {
        var plan = CreateActivePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);
        var denyingLinkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService(canViewTrainingPlans: false);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, denyingLinkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200,
            "the mutation itself must still succeed — only the broadcast is gated");

        await _notifier.DidNotReceive().NotifyAsync(
            _trainerId,
            "trainingprogressupdated",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── Broadcast payload has correct clientId and SessionId ─────────────

    [Fact]
    public async Task HandleAsync_NewCompletion_PayloadHasCorrectClientIdAndSessionId()
    {
        var plan = CreateActivePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        await _notifier.Received(1).NotifyAsync(
            _trainerId,
            "trainingprogressupdated",
            Arg.Is<TrainingProgressUpdatedEvent>(p =>
                p.ClientId == _clientId &&
                p.SessionId == _sessionId),
            Arg.Any<CancellationToken>());
    }

    // ── SessionComplete flag is set when all exercises are done ──────────

    [Fact]
    public async Task HandleAsync_AllExercisesCompleted_PayloadSessionCompleteIsTrue()
    {
        // One exercise in the session; marking it complete makes the session complete.
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            trainerId: _trainerId,
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        await _notifier.Received(1).NotifyAsync(
            _trainerId,
            "trainingprogressupdated",
            Arg.Is<TrainingProgressUpdatedEvent>(p => p.SessionComplete),
            Arg.Any<CancellationToken>());
    }

    // ── Notification is sent to the trainer, not the client ──────────────

    [Fact]
    public async Task HandleAsync_NewCompletion_NotifiesTrainerNotClient()
    {
        var plan = CreateActivePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        // Must be sent to trainer, not the client
        await _notifier.DidNotReceive().NotifyAsync(
            _clientId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());

        await _notifier.Received(1).NotifyAsync(
            _trainerId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── Idempotent path (already complete) → no broadcast ────────────────

    [Fact]
    public async Task HandleAsync_AlreadyComplete_NoBroadcast()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1);

        var plan = CreateActivePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // exercise1 is already complete — idempotent no-op
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No broadcast on the idempotent path
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── No broadcast when client has no trainer (TrainerId = Guid.Empty) ─

    [Fact]
    public async Task HandleAsync_ClientHasNoTrainer_NoBroadcast()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            trainerId: Guid.Empty,
            sectionId: _sectionId); // no trainer linked

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── Version-conflict 409 → no broadcast ──────────────────────────────

    [Fact]
    public async Task HandleAsync_VersionConflict409_NoBroadcast()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [],
            version: 2); // server is at version 2

        var plan = CreateActivePlan();

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        // UpdateOneAsync returns ModifiedCount=0 → version conflict
        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = _exercise1,
                Version = 2
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        // No broadcast on error paths
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── Broadcast failure does NOT fail the mutation (log-and-continue) ──

    [Fact]
    public async Task HandleAsync_BroadcastThrows_MutationStillSucceeds()
    {
        _notifier
            .NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SignalR hub unavailable")));

        var plan = CreateActivePlan();
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb(_clientId, _clientId);

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Should NOT throw; the broadcast exception is swallowed
        var act = async () => await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        await act.Should().NotThrowAsync();
        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }
}
