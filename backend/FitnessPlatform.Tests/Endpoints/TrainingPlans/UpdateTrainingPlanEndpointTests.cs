using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="UpdateTrainingPlanEndpoint"/>.
/// </summary>
public class UpdateTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    /// <summary>
    /// Computes the most recent past Monday relative to today (UTC).
    /// If today is Monday it returns the Monday one week ago so the date is strictly in the past.
    /// Handles Sunday correctly (DayOfWeek.Sunday = 0, which would otherwise produce a negative offset).
    /// </summary>
    private static DateTime LastMonday()
    {
        var today = DateTime.UtcNow.Date;
        int dayNum = (int)today.DayOfWeek; // Sunday=0, Monday=1, ..., Saturday=6
        int daysBack = dayNum switch
        {
            0 => 6, // Sunday: last Monday was 6 days ago
            1 => 7, // Monday: last Monday was 7 days ago (not today)
            _ => dayNum - 1  // Tue–Sat: subtract to reach Monday
        };
        return today.AddDays(-daysBack);
    }

    private UpdateTrainingPlanEndpoint CreateEndpoint(IMongoContext mongo) =>
        Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo);

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

    [Fact]
    public async Task HandleAsync_UnchangedPastStartDate_DoesNotReject()
    {
        // Arrange: plan already saved with a start date that is now in the past.
        var planId = Guid.NewGuid();
        var pastMonday = LastMonday();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 1);
        plan.StartDate = DateTime.SpecifyKind(pastMonday, DateTimeKind.Utc);

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        // Act: PUT with the same StartDate, only changing the name.
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Renamed In-Progress Plan",
            Version = 1,
            StartDate = pastMonday,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        // Assert: should succeed — ReplaceOneAsync called, not rejected.
        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p => p.Name == "Renamed In-Progress Plan"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NewPastStartDate_StillRejects()
    {
        // Arrange: plan with no start date yet.
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 1);
        // StartDate is null — not yet set.

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        // Act: PUT setting StartDate to a past Monday for the first time.
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan",
            Version = 1,
            StartDate = LastMonday(),
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        var act = () => ep.HandleAsync(request, TestContext.Current.CancellationToken);

        // Assert: rejected — a past start date on a plan that never had one is blocked.
        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
