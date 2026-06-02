using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="StartWorkoutEndpoint"/>.
/// StartWorkout now only creates a draft log — no Live lock acquisition or broadcast.
/// Lock acquisition happens in the separate GoLive endpoint (issue #401).
/// </summary>
public class StartWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

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
        IApplicationDbContext? db = null)
    {
        var dbContext = db ?? CreateDbWithProfile();
        return Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, dbContext);
    }

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesLog()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = CreateEndpointWithUser(mongo);

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
            mongo, Substitute.For<IApplicationDbContext>());

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
        var ep = CreateEndpointWithUser(mongo);

        await ep.HandleAsync(new StartWorkoutRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

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
        var ep = CreateEndpointWithUser(mongo);

        await ep.HandleAsync(new StartWorkoutRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);

        await mongo.WorkoutLogs.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanBound_CreatesLog_WithoutBroadcast()
    {
        // StartWorkout no longer fires a Live broadcast — GoLive endpoint does that.
        // This test asserts the log is created and no SignalR fan-out occurs from StartWorkout.
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "My Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [plan]);
        var ep = CreateEndpointWithUser(mongo);

        await ep.HandleAsync(new StartWorkoutRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        // 201 created — draft log exists but no lock was acquired
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w =>
                w.ClientId == _clientId &&
                w.PlanId == planId &&
                w.SessionId == sessionId &&
                !w.IsCompleted),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
