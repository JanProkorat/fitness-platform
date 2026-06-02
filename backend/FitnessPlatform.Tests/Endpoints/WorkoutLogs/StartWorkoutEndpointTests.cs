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
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="StartWorkoutEndpoint"/>.
/// </summary>
public class StartWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });

    private static ISessionLockService CreateNoOpLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(new SessionLock
            {
                SessionId = Guid.NewGuid(), PlanId = Guid.NewGuid(),
                ClientId = Guid.NewGuid(), TrainerId = Guid.NewGuid(),
                Holder = LockHolder.Client, Type = LockType.Live,
                AcquiredAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(6)
            }));
        return svc;
    }

    /// <summary>
    /// Builds a mock IApplicationDbContext containing a ClientProfile for _clientId
    /// with PublicId = _clientId (test shortcut — makes plan.ClientId = _clientId still match).
    /// </summary>
    private IApplicationDbContext CreateDbWithProfile() =>
        new MockDbBuilder()
            .With(new ClientProfile { Id = 1, UserId = _clientId, PublicId = _clientId })
            .Build();

    private StartWorkoutEndpoint CreateEndpointWithUser(
        IMongoContext mongo,
        ISessionLockService lockService,
        IApplicationDbContext? db = null)
    {
        var dbContext = db ?? CreateDbWithProfile();
        return Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, dbContext, lockService, LockOptions, Substitute.For<IRealtimeNotifier>());
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesLog()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = CreateEndpointWithUser(mongo, CreateNoOpLockService());

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w =>
                w.ClientId == _clientId &&
                !w.IsCompleted),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        // No user claims — endpoint returns 401 before any db/lock lookup.
        var ep = Factory.Create<StartWorkoutEndpoint>(
            mongo, Substitute.For<IApplicationDbContext>(), CreateNoOpLockService(),
            LockOptions, Substitute.For<IRealtimeNotifier>());

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        // Plan-bound request but no matching plan in Mongo → 404, no log created.
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        // Empty plan collection — plan does not exist.
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: []);
        var lockService = Substitute.For<ISessionLockService>();
        var ep = CreateEndpointWithUser(mongo, lockService);

        await ep.HandleAsync(new StartWorkoutRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        // Lock must not have been acquired and no log inserted.
        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());

        await mongo.WorkoutLogs.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanBelongsToAnotherClient_Returns403()
    {
        // Plan exists but its ClientId does not match the authenticated client's ProfilePublicId → 403.
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var differentProfileId = Guid.NewGuid(); // plan belongs to someone else's profile

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = differentProfileId, // NOT the caller's ProfilePublicId (_clientId)
            TrainerId = Guid.NewGuid(),
            Name = "Other Client Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [plan]);
        var lockService = Substitute.For<ISessionLockService>();
        var ep = CreateEndpointWithUser(mongo, lockService);

        await ep.HandleAsync(new StartWorkoutRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);

        // Lock must not have been acquired and no log inserted.
        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());

        await mongo.WorkoutLogs.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }
}
