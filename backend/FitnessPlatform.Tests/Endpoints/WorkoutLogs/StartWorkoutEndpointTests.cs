using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
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
/// Since #840, TrainingPlan.ClientId stores ApplicationUser.Id directly, so the endpoint's
/// ownership check is a direct comparison against the caller's JWT-derived UserId — no
/// ClientProfile lookup is involved any more. The endpoint DOES take
/// <see cref="IApplicationDbContext"/> since #935, to resolve the caller's persisted time
/// zone for the SessionExecution.Date calendar-day key. No ApplicationUser row is seeded
/// below unless a test needs a specific time zone, so resolution falls back to UTC —
/// identical to this suite's pre-#935 behaviour.
/// </summary>
public class StartWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private static IApplicationDbContext CreateMockDb() => new MockDbBuilder().Build();

    private StartWorkoutEndpoint CreateEndpointWithUser(IMongoContext mongo, IApplicationDbContext? db = null) =>
        Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db ?? CreateMockDb(), TimeProvider.System);

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
        var ep = Factory.Create<StartWorkoutEndpoint>(mongo, CreateMockDb(), TimeProvider.System);

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

    // ── #935 mandatory live-path round-trip: 00:30 local must resolve to TODAY, not
    //    the server's UTC day ────────────────────────────────────────────────────────

    /// <summary>
    /// The mandatory #935 boundary case: starting a workout at 00:30 LOCAL time in a
    /// positive-UTC-offset zone (Europe/Prague, UTC+1 in January) happens at 23:30 UTC on the
    /// PREVIOUS calendar day. Before #935, <see cref="StartWorkoutEndpoint"/> read
    /// <c>DateTime.UtcNow.Date</c> directly, so the execution's <c>Date</c> landed on the
    /// server's UTC day even though the client's own calendar already read the next day —
    /// <see cref="Features.ClientTraining.GetTodaySession.GetTodaySessionEndpoint"/>'s "today"
    /// filter (also client-local since #935, via <c>db.ResolveClientLocalDateUtcAsync</c>)
    /// would then look for the next day and find nothing: the read/write split-brain this
    /// issue exists to fix.
    /// </summary>
    /// <remarks>
    /// <see cref="Features.ClientTraining.GetTodaySession.GetTodaySessionEndpoint"/> is a
    /// read-only endpoint that resolves "today" from <c>DateTime.UtcNow</c> directly (it takes
    /// no <see cref="TimeProvider"/> — only the two write endpoints touched by #935 do, per the
    /// approved scope), so a literal call through both endpoints in one test can't be pinned to
    /// a single deterministic instant. This test instead proves the invariant the two endpoints
    /// actually share: the write side's persisted <c>SessionExecution.Date</c> (computed here via
    /// a fixed <see cref="TimeProvider"/>) equals <see cref="ClientLocalDateResolver"/>'s result
    /// for the SAME instant and time zone — the exact value
    /// <c>db.ResolveClientLocalDateUtcAsync</c> (and therefore the Today-card's Mongo filter)
    /// would compute at that same instant. Equal values here is precisely what "the Today card
    /// finds it" reduces to at the data layer.
    /// </remarks>
    [Fact]
    public async Task HandleAsync_PragueClientAt0030Local_WritesExecutionOnClientsLocalDay_MatchingWhatTodayCardWouldQuery()
    {
        // 2026-01-15 23:30 UTC == 2026-01-16 00:30 in Europe/Prague (UTC+1 in January).
        var fixedInstantUtc = new DateTime(2026, 1, 15, 23, 30, 0, DateTimeKind.Utc);
        var fixedTimeProvider = new FixedTimeProvider(fixedInstantUtc);
        var pragueTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

        var db = new MockDbBuilder()
            .With(new ApplicationUser { Id = _clientId, TimeZone = "Europe/Prague" })
            .Build();

        var mongo = WorkoutLogTestHelpers.CreateMockMongo();

        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, fixedTimeProvider);

        await ep.HandleAsync(new StartWorkoutRequest(), TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // Sanity check: the client's local calendar day for this instant is 2026-01-16 — the
        // NEXT day relative to the UTC instant — proving this instant genuinely straddles the
        // boundary the bug depended on.
        var todayCardTargetDate = ClientLocalDateResolver.ResolveLocalDateUtcMidnight(fixedInstantUtc, pragueTimeZone);
        todayCardTargetDate.Should().Be(new DateTime(2026, 1, 16, 0, 0, 0, DateTimeKind.Utc),
            "23:30 UTC in January is already past midnight in Europe/Prague (UTC+1)");

        // The write side must have persisted the SAME date the Today-card read side would
        // query for at this instant — this is the round-trip the whole issue is about.
        await mongo.SessionExecutions.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(w => w.ClientId == _clientId && w.Date == todayCardTargetDate),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
