using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.PublishTrainingWeek;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
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
            StubLockService());

        await ep.HandleAsync(new PublishTrainingWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_VersionConflict_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, version: 3);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<PublishTrainingWeekEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            new MockDbBuilder().Build(),
            Substitute.For<INotificationService>(),
            Substitute.For<IRealtimeNotifier>(),
            StubLockService());

        await ep.HandleAsync(new PublishTrainingWeekRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }
}
