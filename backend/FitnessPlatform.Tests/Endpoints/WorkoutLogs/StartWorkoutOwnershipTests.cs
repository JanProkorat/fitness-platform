using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Regression tests for the StartWorkout ownership identity bug (issue #382/PR-#390 regression).
///
/// Root cause: the endpoint previously compared <c>plan.ClientId != Guid.Parse(userId)</c>
/// where <c>userId</c> is the <c>ApplicationUser.Id</c>. But <c>TrainingPlan.ClientId</c> stores
/// the <c>ClientProfile.PublicId</c>, which is a different GUID. The comparison never matched,
/// so every plan-bound StartWorkout returned 403 and the Live lock was never acquired.
///
/// The fix resolves <c>ClientProfile.PublicId</c> via EF for the ownership comparison while
/// keeping <c>ApplicationUser.Id</c> (the JWT user id) as the lock's <c>clientId</c> — because
/// <c>NotificationHub</c> groups SignalR connections by <c>ApplicationUser.Id</c>, so realtime
/// events must target the user id.
/// </summary>
public class StartWorkoutOwnershipTests
{
    // Two distinct GUIDs to prove neither side of the identity split is collapsed.
    private readonly Guid _clientUserId = Guid.NewGuid();   // ApplicationUser.Id (from JWT)
    private readonly Guid _clientProfilePublicId = Guid.NewGuid(); // ClientProfile.PublicId
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });

    // ── Helpers ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// A training plan whose ClientId = _clientProfilePublicId (the real store value).
    /// This is what the trainer creates on behalf of the client.
    /// </summary>
    private TrainingPlan MakePlan() =>
        new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientProfilePublicId, // stores the PROFILE public id, not the user id
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

    /// <summary>
    /// A ClientProfile linking the user (_clientUserId) to their profile public id.
    /// </summary>
    private IApplicationDbContext MakeDbWithOwnerProfile() =>
        new MockDbBuilder()
            .With(new ClientProfile { Id = 1, UserId = _clientUserId, PublicId = _clientProfilePublicId })
            .Build();

    private static ISessionLockService AcquiredLockService(
        Guid expectedClientId,
        Guid expectedTrainerId,
        Guid expectedSessionId,
        Guid expectedPlanId)
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(new SessionLock
            {
                SessionId = expectedSessionId,
                PlanId = expectedPlanId,
                ClientId = expectedClientId,
                TrainerId = expectedTrainerId,
                Holder = LockHolder.Client,
                Type = LockType.Live,
                AcquiredAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(6)
            }));
        return svc;
    }

    // ── Tests ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// The owning client (JWT user id → ClientProfile.PublicId == plan.ClientId) starts a
    /// plan-bound workout.
    /// Expected: 201, Live lock acquired with clientId = ApplicationUser.Id (not the profile id),
    /// WorkoutLog.ClientId = ApplicationUser.Id.
    /// </summary>
    [Fact]
    public async Task StartWorkout_OwningClient_Returns201_LockClientIdIsUserId()
    {
        // Arrange
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);
        var lockService = AcquiredLockService(_clientUserId, _trainerId, _sessionId, _planId);
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientUserId, AppRoles.Client))),
            mongo, MakeDbWithOwnerProfile(), lockService, LockOptions, notifier);

        // Act
        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // Assert — 201 created
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // Lock must be acquired with the LOCK clientId = ApplicationUser.Id (not profile id).
        // This is critical — NotificationHub routes events by ApplicationUser.Id.
        await lockService.Received(1).AcquireAsync(
            _sessionId,
            _planId,
            _clientUserId,    // must be user id — NOT _clientProfilePublicId
            _trainerId,
            LockHolder.Client,
            LockType.Live,
            TimeSpan.FromHours(6),
            Arg.Any<CancellationToken>());

        // WorkoutLog.ClientId must also be the ApplicationUser.Id
        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w =>
                w.ClientId == _clientUserId &&   // user id, not profile id
                w.PlanId == _planId &&
                w.SessionId == _sessionId),
            Arg.Any<MongoDB.Driver.InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        // SignalR events must be sent to the user id (not profile id)
        await notifier.Received(1).NotifyAsync(
            _clientUserId,   // ApplicationUser.Id — what NotificationHub groups on
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Live" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());

        await notifier.Received(1).NotifyAsync(
            _trainerId,
            "sessioneditlockchanged",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A different client (JWT user id → a profile whose PublicId != plan.ClientId) tries to start
    /// a plan that belongs to another client.
    /// Expected: 403, no lock acquired, no log created.
    /// </summary>
    [Fact]
    public async Task StartWorkout_NonOwningClient_Returns403()
    {
        // Arrange — attacker has a valid profile but it's for a DIFFERENT plan
        var attackerUserId = Guid.NewGuid();
        var attackerProfilePublicId = Guid.NewGuid(); // attacker's public id != plan.ClientId

        var attackerDb = new MockDbBuilder()
            .With(new ClientProfile { Id = 2, UserId = attackerUserId, PublicId = attackerProfilePublicId })
            .Build();

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);
        var lockService = Substitute.For<ISessionLockService>();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(attackerUserId, AppRoles.Client))),
            mongo, attackerDb, lockService, LockOptions, notifier);

        // Act
        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // Assert — 403, nothing acquired, nothing created
        ep.HttpContext.Response.StatusCode.Should().Be(403);

        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());

        await mongo.WorkoutLogs.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(),
            Arg.Any<MongoDB.Driver.InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }
}
