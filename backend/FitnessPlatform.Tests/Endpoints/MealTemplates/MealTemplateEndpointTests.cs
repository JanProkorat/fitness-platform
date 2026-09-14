using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.MealTemplates.CopyMealTemplate;
using FitnessPlatform.Application.Features.MealTemplates.DeleteMealTemplate;
using FitnessPlatform.Application.Features.MealTemplates.GetMealTemplate;
using FitnessPlatform.Application.Features.MealTemplates.SaveMealTemplateFromPlan;
using FitnessPlatform.Application.Features.MealTemplates.SearchMealTemplates;
using FitnessPlatform.Application.Features.MealTemplates.UpdateMealTemplate;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using MongoDB.Driver;
using NSubstitute;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Endpoints.MealTemplates;

/// <summary>
/// Testcontainers integration tests for the MealTemplate sharing-library feature (#859) —
/// visibility matrix across all three guard classes (read-guarded reads, read-guarded write
/// (<c>copy</c>), write-guarded mutations), the PUT/DELETE ownership + version-CAS paths, the
/// from-plan copy path, and the calories-descending default search sort. Mirrors the
/// Testcontainers pattern used by <c>LibrarySearchHelperTests</c>/<c>LibraryEntryLoaderTests</c>
/// (#858) rather than NSubstitute-mocked collections, because the loaders and the search helper
/// exercise real MongoDB filter/sort semantics that a mock cannot faithfully reproduce.
/// </summary>
public class MealTemplateEndpointTests : IAsyncLifetime
{
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();
    private readonly MacroCalculatorService _macroCalculator = new();
    private readonly PlanConcurrencyGuard _guard = new();

    private IMongoContext _mongoContext = null!;
    private IMongoCollection<MealTemplate> _templates = null!;
    private IMongoCollection<NutritionPlan> _plans = null!;

    // ── IAsyncLifetime ───────────────────────────────────────────────────────

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var mongoClient = new MongoClient(_mongo.GetConnectionString());
        var database = mongoClient.GetDatabase("fitness_mealtemplate_test");
        _templates = database.GetCollection<MealTemplate>("mealTemplates");
        _plans = database.GetCollection<NutritionPlan>("nutritionPlans");

        var mongoContext = Substitute.For<IMongoContext>();
        mongoContext.MealTemplates.Returns(_templates);
        mongoContext.NutritionPlans.Returns(_plans);
        _mongoContext = mongoContext;
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static TEndpoint CreateEndpoint<TEndpoint>(Guid userId, params object[] dependencies)
        where TEndpoint : class, IEndpoint =>
        Factory.Create<TEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Nutritionist))),
            dependencies);

    private async Task<MealTemplate> InsertTemplateAsync(
        Guid ownerId,
        LibraryVisibility visibility = LibraryVisibility.Private,
        string name = "Test Meal",
        decimal kcal = 300,
        int version = 1)
    {
        var foods = new List<MealFood>
        {
            new()
            {
                FoodExternalId = Guid.NewGuid(),
                FoodName = "Test Food",
                NutrientValuePer100Grams = new NutrientValue { Kcal = kcal, Protein = 10, Carbs = 10, Fat = 5 },
                AmountGrams = 100
            }
        };

        var template = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = name,
            Foods = foods,
            TotalNutrients = _macroCalculator.CalculateMealTotals(foods, []),
            Visibility = visibility,
            DateCreated = DateTime.UtcNow,
            Version = version
        };

        await _templates.InsertOneAsync(template, cancellationToken: TestContext.Current.CancellationToken);
        return template;
    }

    private async Task<MealTemplate?> FindByExternalIdAsync(Guid externalId)
    {
        var cursor = await _templates.FindAsync(
            Builders<MealTemplate>.Filter.Eq(t => t.ExternalId, externalId),
            cancellationToken: TestContext.Current.CancellationToken);
        return await cursor.FirstOrDefaultAsync(TestContext.Current.CancellationToken);
    }

    // ── GetMealTemplate — read-guarded read, visibility matrix ────────────────

    [Fact]
    public async Task GetMealTemplate_OwnPrivate_Returns200()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<GetMealTemplateEndpoint>(ownerId, _mongoContext);
        await ep.HandleAsync(new GetMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetMealTemplate_OwnPublic_Returns200()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<GetMealTemplateEndpoint>(ownerId, _mongoContext);
        await ep.HandleAsync(new GetMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetMealTemplate_OtherOwnersPublic_Returns200()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<GetMealTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new GetMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetMealTemplate_OtherOwnersPrivate_Returns404NotFound()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<GetMealTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new GetMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetMealTemplate_MissingTemplate_Returns404IdenticalToDeniedPrivate()
    {
        var callerId = Guid.NewGuid();

        var ep = CreateEndpoint<GetMealTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new GetMealTemplateRequest { TemplateId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── SearchMealTemplates — visibility filter + calories-descending sort ────

    [Fact]
    public async Task SearchMealTemplates_ReturnsOwnAtAnyVisibilityPlusOthersPublic_NeverOthersPrivate()
    {
        var callerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();

        var ownPrivate = await InsertTemplateAsync(callerId, LibraryVisibility.Private, "Own Private");
        var ownPublic = await InsertTemplateAsync(callerId, LibraryVisibility.Public, "Own Public");
        var othersPublic = await InsertTemplateAsync(otherId, LibraryVisibility.Public, "Others Public");
        await InsertTemplateAsync(otherId, LibraryVisibility.Private, "Others Private");

        var ep = CreateEndpoint<SearchMealTemplatesEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new SearchMealTemplatesRequest { Page = 1, PageSize = 20 }, TestContext.Current.CancellationToken);

        ep.Response.Templates.Select(t => t.TemplateId).Should().BeEquivalentTo(
            [ownPrivate.ExternalId, ownPublic.ExternalId, othersPublic.ExternalId]);
    }

    [Fact]
    public async Task SearchMealTemplates_DefaultSort_IsCaloriesDescending()
    {
        var callerId = Guid.NewGuid();

        var low = await InsertTemplateAsync(callerId, LibraryVisibility.Private, "Low", kcal: 100);
        var high = await InsertTemplateAsync(callerId, LibraryVisibility.Private, "High", kcal: 900);
        var mid = await InsertTemplateAsync(callerId, LibraryVisibility.Private, "Mid", kcal: 500);

        var ep = CreateEndpoint<SearchMealTemplatesEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new SearchMealTemplatesRequest { Page = 1, PageSize = 20 }, TestContext.Current.CancellationToken);

        ep.Response.Templates.Select(t => t.TemplateId)
            .Should().ContainInConsecutiveOrder(high.ExternalId, mid.ExternalId, low.ExternalId);
    }

    // ── CreateMealTemplate — server-computed totals ───────────────────────────
    //
    // CreateMealTemplate_ValidRequest_RecomputesTotalsServerSide moved to
    // CreateMealTemplateEndpointTests.cs — the endpoint's success path calls
    // Send.CreatedAtAsync, which needs a real LinkGenerator (see that file's
    // header for the precedent).

    // ── UpdateMealTemplate — ownership + Version CAS ──────────────────────────

    [Fact]
    public async Task UpdateMealTemplate_Owner_UpdatesAndBumpsVersion()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId);

        var ep = CreateEndpoint<UpdateMealTemplateEndpoint>(
            ownerId, _mongoContext, _macroCalculator, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateMealTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Renamed",
            Visibility = LibraryVisibility.Public,
            Version = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Name.Should().Be("Renamed");
        ep.Response.Version.Should().Be(2);

        var persisted = await FindByExternalIdAsync(template.ExternalId);
        persisted!.Name.Should().Be("Renamed");
        persisted.Visibility.Should().Be(LibraryVisibility.Public);
    }

    [Fact]
    public async Task UpdateMealTemplate_OwnerStaleVersion_Returns409()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, version: 1);

        var ep = CreateEndpoint<UpdateMealTemplateEndpoint>(
            ownerId, _mongoContext, _macroCalculator, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateMealTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Renamed",
            Version = 999
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task UpdateMealTemplate_OtherOwnersPublic_Returns403NotOwned()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<UpdateMealTemplateEndpoint>(
            callerId, _mongoContext, _macroCalculator, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateMealTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Hijacked",
            Version = template.Version
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
    }

    /// <summary>
    /// The property this test exists to pin: a stale version against another owner's Private
    /// entry must still return 404 (denial-before-version-check), never 409 — a 409 here would
    /// disclose the entry's existence to a caller with no read right to it at all.
    /// </summary>
    [Fact]
    public async Task UpdateMealTemplate_OtherOwnersPrivateWithStaleVersion_Returns404NotVersionConflict()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private, version: 1);

        var ep = CreateEndpoint<UpdateMealTemplateEndpoint>(
            callerId, _mongoContext, _macroCalculator, _guard, TimeProvider.System);

        await ep.HandleAsync(new UpdateMealTemplateRequest
        {
            TemplateId = template.ExternalId,
            Name = "Hijacked",
            Version = 999 // deliberately stale/wrong
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── DeleteMealTemplate — write-guarded, hard delete ───────────────────────

    [Fact]
    public async Task DeleteMealTemplate_Owner_RemovesDocumentAndReturns204()
    {
        var ownerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId);

        var ep = CreateEndpoint<DeleteMealTemplateEndpoint>(ownerId, _mongoContext);
        await ep.HandleAsync(new DeleteMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        (await FindByExternalIdAsync(template.ExternalId)).Should().BeNull();
    }

    [Fact]
    public async Task DeleteMealTemplate_OtherOwnersPublic_Returns403AndDoesNotDelete()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Public);

        var ep = CreateEndpoint<DeleteMealTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new DeleteMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(403);
        (await FindByExternalIdAsync(template.ExternalId)).Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteMealTemplate_OtherOwnersPrivate_Returns404()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var template = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<DeleteMealTemplateEndpoint>(callerId, _mongoContext);
        await ep.HandleAsync(new DeleteMealTemplateRequest { TemplateId = template.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── CopyMealTemplate — read-guarded WRITE ─────────────────────────────────
    //
    // CopyMealTemplate_OtherOwnersPublic_Succeeds_NotForbidden and
    // CopyMealTemplate_OwnPrivate_Succeeds moved to CopyMealTemplateEndpointTests.cs —
    // both exercise the endpoint's success path, which calls Send.CreatedAtAsync
    // and needs a real LinkGenerator. CopyMealTemplate_OtherOwnersPrivate_Returns404
    // stays here: it returns before reaching Send.CreatedAtAsync.

    [Fact]
    public async Task CopyMealTemplate_OtherOwnersPrivate_Returns404()
    {
        var ownerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var source = await InsertTemplateAsync(ownerId, LibraryVisibility.Private);

        var ep = CreateEndpoint<CopyMealTemplateEndpoint>(callerId, _mongoContext, TimeProvider.System);
        await ep.HandleAsync(new CopyMealTemplateRequest { TemplateId = source.ExternalId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── SaveMealTemplateFromPlan ───────────────────────────────────────────────

    private async Task<(NutritionPlan Plan, PlanMeal Meal)> InsertPlanWithMealAsync(Guid nutritionistId)
    {
        var meal = new PlanMeal
        {
            MealId = Guid.NewGuid(),
            Kind = MealKind.Lunch,
            Order = 1,
            Foods =
            [
                new MealFood
                {
                    FoodExternalId = Guid.NewGuid(),
                    FoodName = "Rice",
                    NutrientValuePer100Grams = new NutrientValue { Kcal = 130, Protein = 2.7m, Carbs = 28.2m, Fat = 0.3m },
                    AmountGrams = 200
                }
            ]
        };

        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            NutritionistId = nutritionistId,
            ClientId = Guid.NewGuid(),
            Name = "Test Plan",
            Weeks =
            [
                new PlanWeek
                {
                    WeekNumber = 1,
                    Days = [new PlanDay { DayOfWeek = 1, Meals = [meal] }]
                }
            ]
        };

        await _plans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);
        return (plan, meal);
    }

    // SaveMealTemplateFromPlan_ValidRequest_CopiesFoodsAndInheritsKind moved to
    // SaveMealTemplateFromPlanEndpointTests.cs — the endpoint's success path calls
    // Send.CreatedAtAsync, which needs a real LinkGenerator.

    [Fact]
    public async Task SaveMealTemplateFromPlan_PlanNotOwnedByCaller_Returns404()
    {
        var actualOwnerId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var (plan, meal) = await InsertPlanWithMealAsync(actualOwnerId);

        var ep = CreateEndpoint<SaveMealTemplateFromPlanEndpoint>(
            callerId, _mongoContext, _macroCalculator, TimeProvider.System,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new SaveMealTemplateFromPlanRequest
        {
            PlanId = plan.ExternalId,
            WeekNumber = 1,
            DayOfWeek = 1,
            MealId = meal.MealId,
            Name = "Stolen"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task SaveMealTemplateFromPlan_MissingPlan_Returns404()
    {
        var nutritionistId = Guid.NewGuid();

        var ep = CreateEndpoint<SaveMealTemplateFromPlanEndpoint>(
            nutritionistId, _mongoContext, _macroCalculator, TimeProvider.System,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new SaveMealTemplateFromPlanRequest
        {
            PlanId = Guid.NewGuid(),
            WeekNumber = 1,
            DayOfWeek = 1,
            MealId = Guid.NewGuid(),
            Name = "Ghost"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task SaveMealTemplateFromPlan_UnknownMealId_Returns404()
    {
        var nutritionistId = Guid.NewGuid();
        var (plan, _) = await InsertPlanWithMealAsync(nutritionistId);

        var ep = CreateEndpoint<SaveMealTemplateFromPlanEndpoint>(
            nutritionistId, _mongoContext, _macroCalculator, TimeProvider.System,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new SaveMealTemplateFromPlanRequest
        {
            PlanId = plan.ExternalId,
            WeekNumber = 1,
            DayOfWeek = 1,
            MealId = Guid.NewGuid(), // not in the addressed day
            Name = "Wrong meal"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
