using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetFullPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetFullPlanEndpoint"/> — focused on the Supplements field
/// added in issue #332. The supplement list must be visible to the client via this endpoint.
/// </summary>
public class GetFullPlanEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private GetFullPlanEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<GetFullPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, TimeProvider.System);

    /// <summary>
    /// AC #4 — Client endpoint must surface the Supplements list.
    /// When a plan has supplements, GET /client/nutrition/plan/full must include them.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PlanWithSupplements_ResponseIncludesSupplements()
    {
        // Arrange
        var suppId1 = Guid.NewGuid();
        var suppId2 = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = DateTime.UtcNow.Date;
        foreach (var w in plan.Weeks) w.Status = WeekStatus.Published;
        plan.Supplements =
        [
            new Supplement { ExternalId = suppId1, Name = "Vitamin D3", Dose = "1 capsule" },
            new Supplement { ExternalId = suppId2, Name = "Omega-3", Notes = "With fatty meal" }
        ];

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert — supplements are present and correctly mapped
        ep.Response.Should().NotBeNull();
        ep.Response.Supplements.Should().HaveCount(2);
        ep.Response.Supplements[0].ExternalId.Should().Be(suppId1);
        ep.Response.Supplements[0].Name.Should().Be("Vitamin D3");
        ep.Response.Supplements[0].Dose.Should().Be("1 capsule");
        ep.Response.Supplements[1].ExternalId.Should().Be(suppId2);
        ep.Response.Supplements[1].Name.Should().Be("Omega-3");
        ep.Response.Supplements[1].Notes.Should().Be("With fatty meal");
    }

    [Fact]
    public async Task HandleAsync_PlanWithNoSupplements_ResponseHasEmptySupplementsList()
    {
        // Arrange — plan without any supplements
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = DateTime.UtcNow.Date;
        foreach (var w in plan.Weeks) w.Status = WeekStatus.Published;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert — empty list, not null
        ep.Response.Should().NotBeNull();
        ep.Response.Supplements.Should().NotBeNull();
        ep.Response.Supplements.Should().BeEmpty();
    }
}
