using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Regression tests for the StartWorkout ownership identity pattern (issue #382).
///
/// StartWorkout (POST /client/training/logs) now only creates a draft log — lock acquisition
/// and the Live broadcast have moved to the separate GoLive endpoint (issue #401).
///
/// Root-cause note (preserved for history): the endpoint previously compared
/// plan.ClientId against ApplicationUser.Id but TrainingPlan.ClientId stores
/// ClientProfile.PublicId. This file verifies the ownership resolution still uses the
/// profile public id for the plan check while storing the user id on WorkoutLog.ClientId.
/// </summary>
public class StartWorkoutOwnershipTests
{
    // Two distinct GUIDs to prove neither side of the identity split is collapsed.
    private readonly Guid _clientUserId = Guid.NewGuid();          // ApplicationUser.Id (from JWT)
    private readonly Guid _clientProfilePublicId = Guid.NewGuid(); // ClientProfile.PublicId
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

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

    // ── Tests ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// The owning client (JWT user id → ClientProfile.PublicId == plan.ClientId) creates a
    /// plan-bound draft log.
    /// Expected: 201, WorkoutLog.ClientId = ApplicationUser.Id (not profile id).
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
            mongo, MakeDbWithOwnerProfile());

        // Act
        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // Assert — 201 created
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // WorkoutLog.ClientId must be the ApplicationUser.Id (not profile id).
        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w =>
                w.ClientId == _clientUserId &&   // user id, not profile id
                w.PlanId == _planId &&
                w.SessionId == _sessionId),
            Arg.Any<MongoDB.Driver.InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A different client (JWT user id → a profile whose PublicId != plan.ClientId) tries to create
    /// a log for a plan that belongs to another client.
    /// Expected: 403, no log created.
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

        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(attackerUserId, AppRoles.Client))),
            mongo, attackerDb);

        // Act
        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // Assert — 403, nothing created
        ep.HttpContext.Response.StatusCode.Should().Be(403);

        await mongo.WorkoutLogs.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(),
            Arg.Any<MongoDB.Driver.InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
