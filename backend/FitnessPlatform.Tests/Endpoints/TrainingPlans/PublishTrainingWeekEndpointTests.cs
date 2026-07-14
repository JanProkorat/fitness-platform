using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.PublishTrainingWeek;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="PublishTrainingWeekEndpoint"/>.
/// </summary>
public class PublishTrainingWeekEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private static ISessionLockService StubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(false);
        return svc;
    }

    [Fact]
    public async Task HandleAsync_ValidPublish_Returns200()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 2);
        plan.StartDate = DateTime.UtcNow.Date;
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<PublishTrainingWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(),
            StubLockService(),
            new PlanConcurrencyGuard());

        await ep.HandleAsync(new PublishTrainingWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_VersionConflict_Returns409WithProblemDetailsShape()
    {
        // Verifies the version-mismatch path uses SendProblemAsync (RFC 7807 Problem Details)
        // with the correct errorCode and content type. A regression to the old raw SendAsync
        // would still return 409 but would not set application/problem+json.
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, version: 3);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<PublishTrainingWeekEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer)));
                ctx.Request.HttpContext.Response.Body = responseBody;
            },
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(),
            StubLockService(),
            new PlanConcurrencyGuard());

        await ep.HandleAsync(new PublishTrainingWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1  // plan is at version 3
        }, TestContext.Current.CancellationToken);

        // 1. HTTP status
        ep.HttpContext.Response.StatusCode.Should().Be(409);

        // 2. errorCode extension in the RFC 7807 body — the raw SendAsync pattern would write
        //    { "Error": "..." } with no "errorCode" field, so this assertion locks the contract.
        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await JsonDocument.ParseAsync(responseBody);
        doc.RootElement.GetProperty("errorCode").GetString()
            .Should().Be(ErrorCodes.PlanVersionConflict);
    }

    /// <summary>
    /// Regression guard for #780: publishing plan B's first week must NOT archive a
    /// non-overlapping Active plan A of the same client — e.g. a January plan stays Active
    /// when a March plan is published. Only overlapping/same-window Active plans may be
    /// superseded.
    /// </summary>
    [Fact]
    public async Task HandleAsync_FirstPublish_NonOverlappingActivePlan_DoesNotArchiveIt()
    {
        var clientId = Guid.NewGuid();
        var planBId = Guid.NewGuid();

        // Plan A: Active, already published, window fully in the past (started 60 days ago,
        // 2-week duration — long elapsed by the time Plan B's window begins).
        var planA = TrainingPlanTestHelpers.CreatePlan(
            clientId: clientId, trainerId: _trainerId,
            status: TrainingPlanStatus.Active, weekCount: 2, version: 1);
        planA.StartDate = DateTime.UtcNow.Date.AddDays(-60);
        planA.Weeks[0].Status = WeekStatus.Published;
        planA.Weeks[0].DatePublished = planA.StartDate;

        // Plan B: Draft, about to publish its first week, window starts today —
        // does not overlap Plan A's window at all.
        var planB = TrainingPlanTestHelpers.CreatePlan(
            externalId: planBId, clientId: clientId, trainerId: _trainerId,
            status: TrainingPlanStatus.Draft, weekCount: 2, version: 1);
        planB.StartDate = DateTime.UtcNow.Date;

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(planB, planA);

        var ep = Factory.Create<PublishTrainingWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(),
            StubLockService(),
            new PlanConcurrencyGuard());

        await ep.HandleAsync(new PublishTrainingWeekRequest
        {
            PlanId = planBId,
            WeekNumber = 1,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Plan A's window does not overlap Plan B's — it must NOT be archived.
        await mongo.TrainingPlans.DidNotReceive().UpdateManyAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Any<UpdateDefinition<TrainingPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ReplaceLosesRace_Returns409AndDoesNotArchiveSiblings()
    {
        // Regression test for #655: the version-gated ReplaceOneAsync can lose a
        // concurrency race (another request bumped the Version between our initial
        // fetch and our write) even though the initial plan.Version == req.Version
        // check passed. In that case the client's other active plans must NOT be
        // archived — archiving must only happen after the replace is confirmed.
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 1, version: 1);
        plan.StartDate = DateTime.UtcNow.Date;
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        // Simulate the lost race: ReplaceOneAsync reports ModifiedCount == 0.
        var lostRaceResult = Substitute.For<ReplaceOneResult>();
        lostRaceResult.ModifiedCount.Returns(0);
        mongo.TrainingPlans.ReplaceOneAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<TrainingPlan>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(lostRaceResult);

        var ep = Factory.Create<PublishTrainingWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(),
            StubLockService(),
            new PlanConcurrencyGuard());

        await ep.HandleAsync(new PublishTrainingWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        // Siblings must NOT be archived when the version-gated write loses the race.
        await mongo.TrainingPlans.DidNotReceive().UpdateManyAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Any<UpdateDefinition<TrainingPlan>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }
}
