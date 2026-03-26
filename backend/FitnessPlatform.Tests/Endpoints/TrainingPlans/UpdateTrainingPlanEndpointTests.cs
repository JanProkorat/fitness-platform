using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="UpdateTrainingPlanEndpoint"/>.
/// </summary>
public class UpdateTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidUpdate_Returns200()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 2);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] },
                new UpdateTrainingWeekRequest { WeekNumber = 2, Sessions = [] }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_VersionConflict_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, version: 2);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated",
            Version = 1,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }
}
