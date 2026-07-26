using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Tests.Endpoints;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Regression tests for the StartWorkout ownership check (issue #382).
///
/// StartWorkout (POST /client/training/logs) now only creates a draft log — lock acquisition
/// and the Live broadcast have moved to the separate GoLive endpoint (issue #401).
///
/// Root-cause note (updated for #840): the endpoint used to compare plan.ClientId
/// (ClientProfile.PublicId) against a ClientProfile resolved from the caller's
/// ApplicationUser.Id — a two-hop identity split. Since #840, TrainingPlan.ClientId
/// stores ApplicationUser.Id directly, so ownership is a single direct comparison
/// against the caller's JWT-derived UserId; no ClientProfile lookup (and no
/// IApplicationDbContext dependency) is involved any more.
/// </summary>
public class StartWorkoutOwnershipTests
{
    private readonly Guid _clientUserId = Guid.NewGuid(); // ApplicationUser.Id (from JWT), also TrainingPlan.ClientId (#840)
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    // ── Helpers ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// A training plan whose ClientId = _clientUserId (ApplicationUser.Id, #840).
    /// </summary>
    private TrainingPlan MakePlan() =>
        new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientUserId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

    // ── Tests ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// The owning client (JWT user id == plan.ClientId) creates a plan-bound draft log.
    /// Expected: 201, WorkoutLog.ClientId = ApplicationUser.Id.
    /// No lock acquisition here — that happens in GoLive.
    /// </summary>
    [Fact]
    public async Task StartWorkout_OwningClient_Returns201_LogClientIdIsUserId()
    {
        // Arrange
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);

        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientUserId, AppRoles.Client))),
            mongo);

        // Act
        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // Assert — 201 created
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // SessionExecution.ClientId must be the ApplicationUser.Id.
        await mongo.SessionExecutions.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(w =>
                w.ClientId == _clientUserId &&
                w.PlanId == _planId &&
                w.SessionId == _sessionId),
            Arg.Any<MongoDB.Driver.InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A different client (JWT user id != plan.ClientId) tries to create a log for a plan
    /// that belongs to another client.
    /// Expected: 403, no log created.
    /// </summary>
    [Fact]
    public async Task StartWorkout_NonOwningClient_Returns403()
    {
        // Arrange — attacker is a different, valid client whose UserId != plan.ClientId
        var attackerUserId = Guid.NewGuid();

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);

        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(attackerUserId, AppRoles.Client))),
            mongo);

        // Act
        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // Assert — 403, nothing created
        ep.HttpContext.Response.StatusCode.Should().Be(403);

        await mongo.SessionExecutions.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(),
            Arg.Any<MongoDB.Driver.InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
