using System.Security.Claims;
using System.Text.Json;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for the full-state <see cref="UpdatePlanEndpoint"/>.
/// </summary>
public class UpdatePlanFullStateTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    private UpdatePlanEndpoint CreateEndpoint(
        IMongoContext mongo, IMacroCalculatorService macroCalc,
        MemoryStream? responseBody = null,
        IClientLinkAuthorizationService? linkAuthorizationService = null) =>
        Factory.Create<UpdatePlanEndpoint>(
            ctx =>
            {
                ctx.Request.HttpContext.User = new ClaimsPrincipal(
                    new ClaimsIdentity(
                        EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist)));
                if (responseBody is not null)
                    ctx.Request.HttpContext.Response.Body = responseBody;
            },
            mongo,
            macroCalc,
            new MockDbBuilder().Build(),
            Substitute.For<IRealtimeNotifier>(),
            new PlanConcurrencyGuard(),
            linkAuthorizationService ?? EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

    private static UpdateWeekRequest BuildWeekRequest(int weekNumber, MealFood? food = null)
    {
        var mealFoods = food is not null
            ? new List<UpdateMealFoodRequest>
            {
                new()
                {
                    FoodExternalId = food.FoodExternalId,
                    FoodName = food.FoodName,
                    NutrientValuePer100Grams = food.NutrientValuePer100Grams,
                    AmountGrams = food.AmountGrams
                }
            }
            : [];

        return new UpdateWeekRequest
        {
            WeekNumber = weekNumber,
            Days = Enumerable.Range(1, 7).Select(d => new UpdateDayRequest
            {
                DayOfWeek = d,
                Meals =
                [
                    new UpdateMealRequest
                    {
                        Kind = MealKind.Breakfast,
                        Order = 1,
                        Foods = mealFoods
                    }
                ]
            }).ToList()
        };
    }

    [Fact]
    public async Task HandleAsync_ValidFullState_UpdatesPlan()
    {
        var planId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Apple");
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1, food: food)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        macroCalc.Received(1).RecalculateTotals(Arg.Is<NutritionPlan>(p => p.Name == "Updated Plan"));

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p => p.Name == "Updated Plan" && p.Version == 2),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_VersionMismatch_Returns409WithProblemDetailsShape()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 2);

        using var responseBody = new MemoryStream();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc, responseBody);

        // Send request with version 1, but plan is at version 2
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // 1. HTTP status
        ep.HttpContext.Response.StatusCode.Should().Be(409);

        // 2. errorCode extension in the RFC 7807 body — the raw SendAsync pattern would write
        //    { "Error": "..." } with no "errorCode" field, so this assertion locks the contract.
        responseBody.Seek(0, SeekOrigin.Begin);
        using var doc = await JsonDocument.ParseAsync(responseBody);
        doc.RootElement.GetProperty("errorCode").GetString()
            .Should().Be(ErrorCodes.PlanVersionConflict);

        // 3. ReplaceOneAsync never called — confirms the version check fires before persistence
        await mongo.NutritionPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_RemovePublishedWeek_ThrowsError()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 2,
            version: 1);

        // Mark week 1 as Published
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = DateTime.UtcNow;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Send only week 2 — week 1 (Published) is omitted
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 2)]
        };

        var act = () => ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_NotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = Guid.NewGuid(),
            Name = "Ghost Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship). The plan is
    /// owned by the caller, but the caller's link to the plan's client no longer grants nutrition
    /// access — this must still 404, distinct from <see cref="HandleAsync_NotFound_Returns404"/>
    /// which denies on a missing plan.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(
            mongo, macroCalc, linkAuthorizationService: PlanTestHelpers.CreateDenyingLinkAuthorizationService());

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.NutritionPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

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

    [Fact]
    public async Task HandleAsync_UnchangedPastStartDate_DoesNotReject()
    {
        // Arrange: plan already saved with a start date that is now in the past.
        var planId = Guid.NewGuid();
        var pastMonday = LastMonday();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);
        plan.StartDate = DateTime.SpecifyKind(pastMonday, DateTimeKind.Utc);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Act: PUT with the same StartDate, only changing the name.
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Renamed In-Progress Plan",
            Version = 1,
            StartDate = pastMonday,
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert: should succeed — ReplaceOneAsync called, not rejected.
        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p => p.Name == "Renamed In-Progress Plan"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NewPastStartDate_StillRejects()
    {
        // Arrange: plan with no start date yet.
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);
        // StartDate is null — not yet set.

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Act: PUT setting StartDate to a past Monday for the first time.
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Plan",
            Version = 1,
            StartDate = LastMonday(),
            Weeks = [BuildWeekRequest(weekNumber: 1)]
        };

        var act = () => ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert: rejected — a past start date on a plan that never had one is blocked.
        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_PreservesPublishedWeekStatus()
    {
        var planId = Guid.NewGuid();
        var datePublished = DateTime.UtcNow.AddDays(-1);
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 2,
            version: 1);

        // Set week 1 to Published with a known DatePublished
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = datePublished;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        // Send both weeks in the update
        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Still Active Plan",
            Version = 1,
            Weeks =
            [
                BuildWeekRequest(weekNumber: 1),
                BuildWeekRequest(weekNumber: 2)
            ]
        };

        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Status == NutritionPlanStatus.Active &&
                p.Weeks.First(w => w.WeekNumber == 1).Status == WeekStatus.Published &&
                p.Weeks.First(w => w.WeekNumber == 1).DatePublished == datePublished),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Supplement tests ──────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AddSupplements_PersistsAndReturnsInOrder()
    {
        // Arrange
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var suppAId = Guid.NewGuid();
        var suppBId = Guid.NewGuid();

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = "Plan With Supplements",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)],
            Supplements =
            [
                new UpdateSupplementRequest { ExternalId = suppAId, Name = "Vitamin D3", Dose = "1 capsule" },
                new UpdateSupplementRequest { ExternalId = suppBId, Name = "Omega-3", Notes = "Take with fatty meal" }
            ]
        };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert — both supplements persisted in order with correct fields
        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Supplements.Count == 2 &&
                p.Supplements[0].ExternalId == suppAId &&
                p.Supplements[0].Name == "Vitamin D3" &&
                p.Supplements[0].Dose == "1 capsule" &&
                p.Supplements[1].ExternalId == suppBId &&
                p.Supplements[1].Name == "Omega-3" &&
                p.Supplements[1].Notes == "Take with fatty meal"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_UpdateSupplementName_VersionIncrementsAndNewNamePersisted()
    {
        // Arrange — plan already has a supplement
        var planId = Guid.NewGuid();
        var suppId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 3);
        plan.Supplements =
        [
            new Supplement { ExternalId = suppId, Name = "Old Name", Dose = "2 capsules" }
        ];

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = plan.Name,
            Version = 3,
            Weeks = [BuildWeekRequest(weekNumber: 1)],
            Supplements =
            [
                new UpdateSupplementRequest { ExternalId = suppId, Name = "New Name", Dose = "2 capsules" }
            ]
        };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert — name updated, version bumped to 4
        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Version == 4 &&
                p.Supplements.Count == 1 &&
                p.Supplements[0].ExternalId == suppId &&
                p.Supplements[0].Name == "New Name"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_DeleteSupplementByOmission_PersistedPlanHasNoSupplements()
    {
        // Arrange — plan has one supplement; PUT omits it (full-state replace removes it)
        var planId = Guid.NewGuid();
        var suppId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);
        plan.Supplements =
        [
            new Supplement { ExternalId = suppId, Name = "Vitamin C" }
        ];

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = plan.Name,
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)],
            Supplements = []   // deliberately empty — removes the supplement
        };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert — no supplements in persisted document
        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p => p.Supplements.Count == 0),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SupplementWithEmptyName_ThrowsValidationError()
    {
        // This test validates via the validator, not the endpoint handler directly.
        // Use the FastEndpoints Validator.CreateInstance pattern consistent with existing validator tests.
        var validator = new UpdatePlanValidator();

        var req = new UpdatePlanRequest
        {
            Name = "Valid Plan Name",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)],
            Supplements =
            [
                new UpdateSupplementRequest { ExternalId = Guid.NewGuid(), Name = "" }  // empty name
            ]
        };

        var result = await validator.ValidateAsync(req);

        result.IsValid.Should().BeFalse();
        // Anchor on ErrorMessage, not PropertyName — the global FluentValidation resolver is
        // camelCased by any app-booting test in the full suite (e.g. CatalogSeedingTests), which
        // turns PropertyName into "supplements[0].name" and makes case-sensitive Contains("Name")
        // flake depending on run order. See project convention (FluentValidation PropertyName flake).
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("Supplement Name must not be empty"));
    }

    [Fact]
    public async Task HandleAsync_SupplementNameExceedsMaxLength_ThrowsValidationError()
    {
        var validator = new UpdatePlanValidator();

        var req = new UpdatePlanRequest
        {
            Name = "Valid Plan Name",
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)],
            Supplements =
            [
                new UpdateSupplementRequest
                {
                    ExternalId = Guid.NewGuid(),
                    Name = new string('A', 101),   // 101 chars > max 100
                    Dose = "1 tablet"
                }
            ]
        };

        var result = await validator.ValidateAsync(req);

        result.IsValid.Should().BeFalse();
        // Anchor on ErrorMessage only, not PropertyName — see the flake note above.
        result.Errors.Should().Contain(e =>
            e.ErrorMessage.Contains("Supplement Name must not exceed 100 characters"));
    }

    [Fact]
    public async Task HandleAsync_Supplements_NewExternalIdGeneratedWhenNotProvided()
    {
        // Arrange — client sends supplement without ExternalId (null) — server generates one
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(
            externalId: planId,
            nutritionistId: _nutritionistId,
            weekCount: 1,
            version: 1);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var macroCalc = Substitute.For<IMacroCalculatorService>();
        var ep = CreateEndpoint(mongo, macroCalc);

        var req = new UpdatePlanRequest
        {
            PlanId = planId,
            Name = plan.Name,
            Version = 1,
            Weeks = [BuildWeekRequest(weekNumber: 1)],
            Supplements =
            [
                new UpdateSupplementRequest { ExternalId = null, Name = "Zinc" }
            ]
        };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert — persisted document has a non-empty ExternalId even though client sent null
        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Is<NutritionPlan>(p =>
                p.Supplements.Count == 1 &&
                p.Supplements[0].ExternalId != Guid.Empty),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
