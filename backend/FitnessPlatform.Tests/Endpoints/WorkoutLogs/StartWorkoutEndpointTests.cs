using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="StartWorkoutEndpoint"/>.
/// StartWorkout now only creates a draft log — no Live lock acquisition or broadcast.
/// Lock acquisition happens in the separate GoLive endpoint (issue #401).
/// Since #840, TrainingPlan.ClientId stores ApplicationUser.Id directly, so the endpoint's
/// ownership check is a direct comparison against the caller's JWT-derived UserId — no
/// IApplicationDbContext dependency (no ClientProfile lookup) is involved any more.
/// </summary>
public class StartWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private StartWorkoutEndpoint CreateEndpointWithUser(IMongoContext mongo) =>
        Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesLog()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = CreateEndpointWithUser(mongo);

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.SessionExecutions.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(w =>
                w.ClientId == _clientId &&
                w.Status == SessionExecutionStatus.Partial),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        // No user claims — endpoint returns 401 before any lock/plan lookup.
        var ep = Factory.Create<StartWorkoutEndpoint>(mongo);

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

        await mongo.SessionExecutions.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanBelongsToAnotherClient_Returns403()
    {
        // Plan exists but its ClientId (ApplicationUser.Id, #840) does not match the
        // authenticated client's UserId → 403.
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var differentUserId = Guid.NewGuid(); // plan belongs to a different client

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = differentUserId, // NOT the caller's UserId (_clientId)
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

        await mongo.SessionExecutions.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
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

        await mongo.SessionExecutions.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(w =>
                w.ClientId == _clientId &&
                w.PlanId == planId &&
                w.SessionId == sessionId &&
                w.Status == SessionExecutionStatus.Partial),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
