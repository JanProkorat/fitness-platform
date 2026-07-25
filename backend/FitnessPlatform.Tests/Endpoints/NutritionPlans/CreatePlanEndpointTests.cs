using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="CreatePlanEndpoint"/>.
/// </summary>
public class CreatePlanEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_CreatesPlan()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "Weight Loss Plan",
            WeekCount = 2
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p =>
                p.Name == "Weight Loss Plan" &&
                p.ClientId == _clientId &&
                p.NutritionistId == _nutritionistId &&
                p.Status == NutritionPlanStatus.Draft &&
                p.Weeks.Count == 2 &&
                p.Weeks[0].Days.Count == 7),
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
        var existingPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active,
            weekCount: 4);
        existingPlan.StartDate = DateTime.UtcNow.Date;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [existingPlan]);
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        using var responseBody = new MemoryStream();
        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist)));
                ctx.Request.HttpContext.Response.Body = responseBody;
            },
            mongo, authHelper, db);

        // New plan's window [today, today+14) overlaps the existing plan's [today, today+28).
        var request = new CreatePlanRequest
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

        await mongo.NutritionPlans.DidNotReceive().InsertOneAsync(
            Arg.Any<NutritionPlan>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// #780: a new plan whose window does NOT overlap any existing plan for the client must
    /// be created normally, even when an Active plan already exists (multi-plan support).
    /// </summary>
    [Fact]
    public async Task HandleAsync_NonOverlappingWindow_CreatesPlan()
    {
        // Existing Active plan, window fully in the past.
        var existingPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            nutritionistId: _nutritionistId,
            status: NutritionPlanStatus.Active,
            weekCount: 2);
        existingPlan.StartDate = DateTime.UtcNow.Date.AddDays(-60);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [existingPlan]);
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        var request = new CreatePlanRequest
        {
            ClientId = _clientId,
            Name = "New Non-Overlapping Plan",
            WeekCount = 2,
            StartDate = DateTime.UtcNow.Date
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).InsertOneAsync(
            Arg.Is<NutritionPlan>(p => p.Name == "New Non-Overlapping Plan"),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoLink_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: false);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, authHelper, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var authHelper = CreateAuthHelper(hasLink: true);
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<CreatePlanEndpoint>(mongo, authHelper, db);

        await ep.HandleAsync(
            new CreatePlanRequest { ClientId = _clientId, Name = "Plan" },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    private static NutritionAuthHelper CreateAuthHelper(bool hasLink)
    {
        // Create db substitute first, then partial substitute — avoids NSubstitute nesting pitfall
        var db = Substitute.For<IApplicationDbContext>();
        var helper = Substitute.ForPartsOf<NutritionAuthHelper>(db);
        helper.HasActiveLinkAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(hasLink);
        return helper;
    }
}
