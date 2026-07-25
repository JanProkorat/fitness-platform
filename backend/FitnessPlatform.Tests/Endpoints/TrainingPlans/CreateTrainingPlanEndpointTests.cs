using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="CreateTrainingPlanEndpoint"/>.
/// </summary>
public class CreateTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesPlan()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper, db);

        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Hypertrophy Block",
            WeekCount = 4
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.TrainingPlans.Received(1).InsertOneAsync(
            Arg.Is<TrainingPlan>(p =>
                p.Name == "Hypertrophy Block" &&
                p.ClientId == _clientId &&
                p.TrainerId == _trainerId &&
                p.Weeks.Count == 4 &&
                p.Version == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// #780 Task 3: creating a plan whose date window overlaps an existing Active plan for
    /// the same client must be rejected with 409 + ErrorCodes.PlanOverlap.
    /// </summary>
    [Fact]
    public async Task HandleAsync_OverlappingWindow_Returns409WithPlanOverlapCode()
    {
        var existingPlan = TrainingPlanTestHelpers.CreatePlan(
            clientId: _clientId,
            trainerId: _trainerId,
            status: TrainingPlanStatus.Active,
            weekCount: 4);
        existingPlan.StartDate = DateTime.UtcNow.Date;

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(existingPlan);
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer)));
                ctx.Request.HttpContext.Response.Body = responseBody;
            },
            mongo, authHelper, db);

        // New plan's window [today, today+14) overlaps the existing plan's [today, today+28).
        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Overlapping Plan",
            WeekCount = 2,
            StartDate = DateTime.UtcNow.Date
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(
            responseBody, cancellationToken: TestContext.Current.CancellationToken);
        doc.RootElement.GetProperty("errorCode").GetString().Should().Be(ErrorCodes.PlanOverlap);

        await mongo.TrainingPlans.DidNotReceive().InsertOneAsync(
            Arg.Any<TrainingPlan>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// #780: a new plan whose window does NOT overlap any existing plan for the client must
    /// be created normally, even when an Active plan already exists (multi-plan support).
    /// </summary>
    [Fact]
    public async Task HandleAsync_NonOverlappingWindow_CreatesPlan()
    {
        // Existing Active plan, window fully in the past.
        var existingPlan = TrainingPlanTestHelpers.CreatePlan(
            clientId: _clientId,
            trainerId: _trainerId,
            status: TrainingPlanStatus.Active,
            weekCount: 2);
        existingPlan.StartDate = DateTime.UtcNow.Date.AddDays(-60);

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(existingPlan);
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper, db);

        var request = new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "New Non-Overlapping Plan",
            WeekCount = 2,
            StartDate = DateTime.UtcNow.Date
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.TrainingPlans.Received(1).InsertOneAsync(
            Arg.Is<TrainingPlan>(p => p.Name == "New Non-Overlapping Plan"),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoActiveLink_Returns404()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper(false);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, authHelper, db);

        await ep.HandleAsync(new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Test"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongo();
        var authHelper = TrainingPlanTestHelpers.CreateMockAuthHelper();
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<CreateTrainingPlanEndpoint>(mongo, authHelper, db);

        await ep.HandleAsync(new CreateTrainingPlanRequest
        {
            ClientId = _clientId,
            Name = "Test"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
